// server/src/routes/knowledge.ts
// Knowledge conflict resolution routes (PRD-03 Section 3.3)

import { Router, Request, Response } from 'express';
import {
  getAllConflicts,
  resolveConflict,
  batchResolveConflicts,
  aiMergeConflict,
  getImportProgress,
  inferProgressFromKnowledge,
  prescanConflicts,
  batchMergeLowRisk,
  resolveConflictCoexist,
} from '../services/knowledge';
import { importNextChapter } from '../agents/extractor';
import {
  resolveConflictSchema,
  batchResolveSchema,
  aiMergeSchema,
  importNextChapterSchema,
  prescanSchema,
  batchMergeLowRiskSchema,
  coexistSchema,
} from '../types/knowledge';
import { createLogger } from '../utils/logger';
import knowledgeManagementRouter from './knowledge-management';

const logger = createLogger('routes-knowledge');
const knowledgeRouter = Router();

// AbortController for "import next chapter" (PRD-10)
let controller: AbortController | null = null;

/**
 * GET /api/v1/knowledge/conflicts
 * Get all unresolved conflicts.
 */
knowledgeRouter.get('/conflicts', async (_req: Request, res: Response) => {
  try {
    const conflicts = await getAllConflicts();
    res.json({ conflicts });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get conflicts:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/v1/knowledge/conflicts/:entryId/:field
 * Resolve a single conflict.
 */
knowledgeRouter.put('/conflicts/:entryId/:field', async (req: Request, res: Response) => {
  try {
    const parsed = resolveConflictSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const { entryId, field } = req.params as { entryId: string; field: string };

    const result = await resolveConflict(
      entryId,
      field, // Express already decodes route params
      parsed.data.resolution,
      parsed.data.manualValue,
    );

    if (!result) {
      res.status(404).json({ error: '冲突不存在或已解决' });
      return;
    }

    res.json({ message: '冲突已解决', entry: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to resolve conflict:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/knowledge/conflicts/batch
 * Batch resolve multiple conflicts.
 */
knowledgeRouter.post('/conflicts/batch', async (req: Request, res: Response) => {
  try {
    const parsed = batchResolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const count = await batchResolveConflicts(parsed.data.resolutions);
    res.json({ message: `已解决 ${count} 个冲突`, resolved: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to batch resolve conflicts:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/knowledge/conflicts/ai-merge
 * AI-merge two conflicting text values.
 */
knowledgeRouter.post('/conflicts/ai-merge', async (req: Request, res: Response) => {
  try {
    const parsed = aiMergeSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('AI merge request validation failed', parsed.error.issues);
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    logger.info(`AI merge request received: mode=${parsed.data.mode}, oldLen=${parsed.data.oldValue.length}, newLen=${parsed.data.newValue.length}`);
    const merged = await aiMergeConflict(
      parsed.data.oldValue,
      parsed.data.newValue,
      parsed.data.mode,
    );

    res.json({ merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to AI merge conflict:', err);
    res.status(500).json({ error: message });
  }
});

// ============================================================
// PRD-10: 导入进度管理
// ============================================================

/**
 * GET /api/v1/knowledge/import-progress
 * 获取所有分类的导入进度
 */
knowledgeRouter.get('/import-progress', async (_req: Request, res: Response) => {
  try {
    const progress = await getImportProgress();
    res.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to get import progress:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v1/knowledge/import-progress/infer
 * 从知识库反向推断指定分类的导入进度
 */
knowledgeRouter.get('/import-progress/infer', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    if (!category) {
      res.status(400).json({ error: '请提供分类参数 category' });
      return;
    }
    const chapterIndex = await inferProgressFromKnowledge(category);
    res.json({ category, lastImportedChapterIndex: chapterIndex });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to infer import progress:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/knowledge/import-next
 * 导入下一章（提取+合并）
 */
knowledgeRouter.post('/import-next', async (req: Request, res: Response) => {
  try {
    const parsed = importNextChapterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const { category, chapterIndex } = parsed.data;
    controller = new AbortController();

    const result = await importNextChapter(category, chapterIndex, controller.signal);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to import next chapter:', err);
    if (message.includes('不存在') || message.includes('请先上传')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /api/v1/knowledge/import-next/cancel
 * 取消正在进行的"导入下一章"操作
 */
knowledgeRouter.post('/import-next/cancel', async (_req: Request, res: Response) => {
  if (controller) {
    controller.abort();
    controller = null;
  }
  res.json({ message: '已取消导入' });
});

// ============================================================
// PRD-10: 冲突预扫描与批量合并
// ============================================================

/**
 * POST /api/v1/knowledge/conflicts/prescan
 * 预扫描未裁决冲突的风险等级
 */
knowledgeRouter.post('/conflicts/prescan', async (req: Request, res: Response) => {
  try {
    const parsed = prescanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const results = await prescanConflicts(parsed.data.entryIds);
    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to prescan conflicts:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/knowledge/conflicts/batch-merge-low
 * 批量合并低风险冲突
 */
knowledgeRouter.post('/conflicts/batch-merge-low', async (req: Request, res: Response) => {
  try {
    const parsed = batchMergeLowRiskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const resolved = await batchMergeLowRisk(parsed.data.entryIds);
    res.json({ resolved, message: `已合并 ${resolved} 个低风险冲突` });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to batch merge low risk conflicts:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/v1/knowledge/conflicts/:entryId/:field/coexist
 * 以并行共存方式解决冲突
 */
knowledgeRouter.put('/conflicts/:entryId/:field/coexist', async (req: Request, res: Response) => {
  try {
    const parsed = coexistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const { entryId, field } = req.params as { entryId: string; field: string };
    const { oldChapterIndex, oldChapterTitle, newChapterIndex, newChapterTitle } = parsed.data;

    const result = await resolveConflictCoexist(
      entryId,
      field,
      oldChapterIndex,
      oldChapterTitle,
      newChapterIndex,
      newChapterTitle,
    );

    if (!result) {
      res.status(404).json({ error: '冲突不存在或已解决' });
      return;
    }

    res.json({ message: '冲突已以并行共存方式解决', entry: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to coexist conflict:', err);
    res.status(500).json({ error: message });
  }
});

// Mount knowledge management routes (PRD-04)
knowledgeRouter.use(knowledgeManagementRouter);

export default knowledgeRouter;
