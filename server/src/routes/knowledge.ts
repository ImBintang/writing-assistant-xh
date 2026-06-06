// server/src/routes/knowledge.ts
// Knowledge conflict resolution routes (PRD-03 Section 3.3)

import { Router, Request, Response } from 'express';
import {
  getAllConflicts,
  resolveConflict,
  batchResolveConflicts,
} from '../services/knowledge';
import { resolveConflictSchema, batchResolveSchema } from '../types/knowledge';
import { createLogger } from '../utils/logger';
import knowledgeManagementRouter from './knowledge-management';

const logger = createLogger('routes-knowledge');
const knowledgeRouter = Router();

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
 * PUT /api/v1/knowledge/conflicts/:id
 * Resolve a single conflict.
 * The :id parameter is entryId (the format is <entryId>/<conflictIndex>).
 */
knowledgeRouter.put('/conflicts/:id', async (req: Request, res: Response) => {
  try {
    const parsed = resolveConflictSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    // Parse the composite ID: <entryId>/<conflictIndex>
    const idParam = String(req.params.id);
    const [entryId, conflictIndexStr] = idParam.split('/');
    const conflictIndex = parseInt(conflictIndexStr, 10);

    if (!entryId || isNaN(conflictIndex)) {
      res.status(400).json({
        error: '无效的冲突ID格式，需要 <entryId>/<conflictIndex>',
      });
      return;
    }

    const result = await resolveConflict(
      entryId,
      conflictIndex,
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

// Mount knowledge management routes (PRD-04)
knowledgeRouter.use(knowledgeManagementRouter);

export default knowledgeRouter;
