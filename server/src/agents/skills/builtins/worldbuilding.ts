// server/src/agents/skills/builtins/worldbuilding.ts
// Built-in Skill: Worldbuilding (世界观) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const worldbuildingSkill: SkillDefinition = {
  id: 'builtin-worldbuilding',
  name: '世界观提取',
  category: 'worldbuilding',
  description: '提取小说中的世界观设定，包括规则体系、历史事件、势力格局、文化习俗等',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有世界观相关的设定信息。

## 提取规则
1. 提取所有明确提到的世界观设定：修炼体系规则、世界架构、势力格局、历史背景、文化习俗等
2. 不确定的内容不要编造 — 留空或省略
3. 世界观类型包括：修炼体系、世界架构、势力格局、历史事件、文化习俗、种族设定、天地法则等
4. 如果有涉及的角色/势力，请列出
5. 如果没有发现任何世界观设定，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个条目包含：
- name: 设定名称（必填）
- aliases: 别名（可选）
- attributes: 设定属性对象，可包含：
  - type: 设定类型（"修炼体系"/"世界架构"/"势力格局"/"历史事件"/"文化习俗"/"种族设定"/"天地法则"/"其他"）
  - description: 规则/设定描述
  - relatedEntities: 涉及的实体（角色/势力/地点）
  - timeline: 时间线/时期描述
  - impact: 对故事的影响程度（"核心设定"/"重要设定"/"一般设定"）
- description: 设定综合描述（可选）
- relations: 与其他设定的关系（可选）

## 原则
- 宁可漏提，不可编造
- 只输出 JSON，不要其他文字`,
  outputSchema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '设定名称（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '设定类型' },
                description: { type: 'string', description: '规则/设定描述' },
                relatedEntities: { type: 'string', description: '涉及的实体' },
                timeline: { type: 'string', description: '时间线/时期描述' },
                impact: { type: 'string', description: '影响程度：核心设定/重要设定/一般设定' },
              },
              description: '世界观设定属性',
            },
            description: { type: 'string', description: '设定综合描述' },
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  targetName: { type: 'string' },
                  relationType: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['targetName', 'relationType'],
              },
            },
          },
          required: ['name', 'attributes'],
        },
        description: '提取的世界观条目列表',
      },
    },
    required: ['entries'],
  },
};

export default worldbuildingSkill;
