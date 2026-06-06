// server/src/routes/extract.ts
// Extraction task routes (PRD-03 Section 3.1)
// Updated with mutex to ensure single extraction at a time

import { Router, Request, Response } from 'express';
import { getExtractionManager } from '../agents';
import { extractRequestSchema } from '../types/knowledge';
import { createLogger } from '../utils/logger';
import { getTaskQueue } from '../utils/mutex';

const logger = createLogger('routes-extract');
const extractRouter = Router();

/**
 * POST /api/v1/extract/start
 * Start a knowledge extraction task.
 * Uses task queue to ensure only one extraction runs at a time.
 */
extractRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const parsed = extractRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: '请求参数校验失败',
        details: parsed.error.issues,
      });
      return;
    }

    const taskQueue = getTaskQueue();

    // Check if an extraction is already running
    if (taskQueue.isRunning('extract')) {
      res.status(409).json({
        error: '已有提取任务正在运行，请等待当前任务完成后再启动新任务',
        status: 409,
      });
      return;
    }

    const manager = getExtractionManager();
    const result = manager.startExtraction(parsed.data);

    // Track the extraction in the queue so it blocks subsequent extractions
    // but doesn't block other function types (write, brainstorm)
    taskQueue.enqueue('extract', async () => {
      // The extraction runs asynchronously via the manager; we just hold the lock
      // until the task completes or is cancelled
      return new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          try {
            const status = manager.getTaskStatus(result.taskId);
            if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
              clearInterval(checkInterval);
              resolve();
            }
          } catch {
            // Task no longer exists
            clearInterval(checkInterval);
            resolve();
          }
        }, 2000); // Poll every 2 seconds
      });
    }).catch((err) => {
      logger.warn(`Extraction queue task error: ${err}`);
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    logger.error('Failed to start extraction:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v1/extract/:taskId/status
 * Get extraction task status and progress.
 */
extractRouter.get('/:taskId/status', (req: Request, res: Response) => {
  try {
    const manager = getExtractionManager();
    const status = manager.getTaskStatus(String(req.params.taskId));
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    if (message.includes('不存在')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

/**
 * POST /api/v1/extract/:taskId/cancel
 * Cancel a running extraction task.
 */
extractRouter.post('/:taskId/cancel', (req: Request, res: Response) => {
  try {
    const manager = getExtractionManager();
    manager.cancelTask(String(req.params.taskId));
    res.json({ message: '已请求取消任务' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '内部错误';
    res.status(400).json({ error: message });
  }
});

export default extractRouter;
