// server/src/routes/skills.ts
// Skill management routes (PRD-03 Section 3.2)

import { Router, Request, Response } from 'express';
import { getSkillRegistry } from '../agents/skills/registry';
import {
  createSkillSchema,
  updateSkillSchema,
  generatePromptSchema,
} from '../types/knowledge';
import { createLogger } from '../utils/logger';

const logger = createLogger('routes-skills');
const skillsRouter = Router();

function generateSkillId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * GET /api/v1/skills
 * Get all skills (built-in + custom).
 */
skillsRouter.get('/', (_req: Request, res: Response) => {
  const registry = getSkillRegistry();
  const skills = registry.getAllSkills();
  res.json({ skills });
});

/**
 * POST /api/v1/skills
 * Create a custom skill.
 */
skillsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const registry = getSkillRegistry();
    const id = generateSkillId();

    const skill = {
      id,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      promptTemplate: parsed.data.promptTemplate || '',
      outputSchema: parsed.data.outputSchema || {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                attributes: { type: 'object' },
              },
              required: ['name', 'attributes'],
            },
          },
        },
        required: ['entries'],
      },
      isBuiltIn: false,
      enabled: true,
    };

    registry.registerCustomSkill(skill);
    await registry.saveCustomSkillToDisk(skill);

    res.status(201).json(skill);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to create skill:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/v1/skills/:id
 * Update a custom skill. Built-in skills return 403.
 */
skillsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const registry = getSkillRegistry();
    const skillId = String(req.params.id);

    // Check it's not built-in
    if (registry.isBuiltIn(skillId)) {
      res.status(403).json({ error: '内置技能不可修改' });
      return;
    }

    const parsed = updateSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const existing = registry.getSkill(skillId);
    if (!existing) {
      res.status(404).json({ error: '技能不存在' });
      return;
    }

    const updated = {
      ...existing,
      ...parsed.data,
      id: existing.id, // ID cannot change
      isBuiltIn: false,
    };

    registry.registerCustomSkill(updated);
    await registry.saveCustomSkillToDisk(updated);

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to update skill:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/v1/skills/:id
 * Delete a custom skill. Built-in skills return 403.
 */
skillsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const registry = getSkillRegistry();
    const skillId = String(req.params.id);

    if (registry.isBuiltIn(skillId)) {
      res.status(403).json({ error: '内置技能不可删除' });
      return;
    }

    const existing = registry.getSkill(skillId);
    if (!existing) {
      res.status(404).json({ error: '技能不存在' });
      return;
    }

    registry.unregisterCustomSkill(skillId);
    await registry.deleteCustomSkillFromDisk(skillId);

    res.json({ message: '已删除' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to delete skill:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/skills/:id/generate
 * AI-assisted Skill prompt generation.
 */
skillsRouter.post('/:id/generate', async (req: Request, res: Response) => {
  try {
    const parsed = generatePromptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    // Use the AI client to generate a prompt template
    const { runExtraction } = await import('../agents/client.js');

    const metaPrompt = `你是一个Skill设计专家。请为用户的新知识提取技能设计一个中文的提取提示词模板(Prompt Template)。

## 用户的需求
- Skill名称: ${parsed.data.name}
- 分类: ${parsed.data.category}
- 描述: ${parsed.data.description}

## 你的任务
1. 写一个详细的中文Prompt Template，包含提取规则、输出格式说明、示例和原则
2. 设计一个合适的JSON Schema用于结构化输出

## 输出格式
请严格按照以下JSON格式输出：
{
  "promptTemplate": "...完整的prompt模板，使用 {{chapterContent}} 和 {{chapterTitle}} 作为占位符...",
  "outputSchema": { ...JSON Schema 对象... }
}

Prompt模板应遵循以下原则：
- 明确列出提取的字段和说明
- 包含"不确定则不输出"的防幻觉原则
- 输出只包含JSON，不要其他文字
- 返回格式为 { "entries": [ ... ] }`;

    const result = await runExtraction({
      systemPrompt: metaPrompt,
      chapterContent: `Skill名称: ${parsed.data.name}\n分类: ${parsed.data.category}\n描述: ${parsed.data.description}`,
      chapterTitle: 'Skill生成',
      chapterIndex: 0,
      outputSchema: {
        type: 'object',
        properties: {
          promptTemplate: { type: 'string', description: '完整的Skill prompt模板' },
          outputSchema: {
            type: 'object',
            description: 'JSON Schema for structured output',
          },
        },
        required: ['promptTemplate', 'outputSchema'],
      },
      modelId: 'claude-sonnet-4-6',
    });

    if (result.entries.length > 0) {
      const generated = result.entries[0].attributes as {
        promptTemplate?: string;
        outputSchema?: Record<string, unknown>;
      };
      res.json({
        promptTemplate: generated.promptTemplate || '',
        outputSchema: generated.outputSchema || {},
      });
    } else {
      res.status(500).json({ error: 'AI未能生成有效的Prompt模板' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to generate skill prompt:', err);
    res.status(500).json({ error: message });
  }
});

export default skillsRouter;
