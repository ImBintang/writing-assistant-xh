// server/src/agents/index.ts
// ExtractionManager singleton — manages extraction task lifecycle and WebSocket broadcasting

import type { WebSocket } from 'ws';
import { createLogger } from '../utils/logger';
import { runExtractionTask } from './extractor';
import type {
  ExtractRequest,
  ExtractionStatusResponse,
  ProgressUpdate,
  MergeResult,
} from '../types/knowledge';

const logger = createLogger('extraction-manager');

function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ExtractionTaskInternal {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: {
    chapterIds: number[];
    categories: string[];
    customSkillIds?: string[];
  };
  progress: {
    totalSteps: number;
    completedSteps: number;
    currentChapterIndex: number | null;
    currentChapterTitle: string | null;
    currentCategory: string | null;
    resultsByCategory: Record<string, unknown[]>;
  };
  errors: unknown[];
  abortController: AbortController;
  startedAt: string;
  completedAt?: string;
  finalStatus?: ExtractionStatusResponse;
}

export class ExtractionManager {
  private tasks: Map<string, ExtractionTaskInternal> = new Map();
  private wsClients: Map<string, Set<WebSocket>> = new Map();

  /**
   * Start a new extraction task.
   */
  startExtraction(req: ExtractRequest): { taskId: string } {
    const taskId = generateTaskId();

    const task: ExtractionTaskInternal = {
      taskId,
      status: 'pending',
      config: {
        chapterIds: req.chapterIds,
        categories: req.categories,
        customSkillIds: req.customSkillIds,
      },
      progress: {
        totalSteps: req.chapterIds.length * req.categories.length,
        completedSteps: 0,
        currentChapterIndex: null,
        currentChapterTitle: null,
        currentCategory: null,
        resultsByCategory: {},
      },
      errors: [],
      abortController: new AbortController(),
      startedAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, task);
    logger.info(
      `Extraction task created: ${taskId} (chapters=${req.chapterIds.length}, categories=${req.categories.join(',')})`,
    );

    // Start running asynchronously
    this.runTask(task).catch((err) => {
      logger.error(`Task ${taskId} failed unexpectedly:`, err);
    });

    return { taskId };
  }

  /**
   * Get the status of a task.
   */
  getTaskStatus(taskId: string): ExtractionStatusResponse {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const response: ExtractionStatusResponse = {
      status: task.status,
      progress: {
        totalSteps: task.progress.totalSteps,
        completedSteps: task.progress.completedSteps,
        currentChapterIndex: task.progress.currentChapterIndex,
        currentChapterTitle: task.progress.currentChapterTitle,
        currentCategory: task.progress.currentCategory,
      },
      errors:
        task.errors.length > 0
          ? (task.errors as ExtractionStatusResponse['errors'])
          : undefined,
    };

    // When task is completed, include result summary
    if (task.status === 'completed' || task.status === 'failed') {
      const resultsByCategory: Record<string, number> = {};
      for (const [category, entries] of Object.entries(task.progress.resultsByCategory)) {
        resultsByCategory[category] = entries.length;
      }
      (response as any).results = resultsByCategory;
    }

    return response;
  }

  /**
   * Cancel a running task.
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      throw new Error(`任务状态为 ${task.status}，无法取消`);
    }

    task.abortController.abort();
    logger.info(`Cancellation requested for task: ${taskId}`);
  }

  /**
   * Subscribe a WebSocket client to task progress updates.
   */
  subscribeToProgress(taskId: string, ws: WebSocket): void {
    if (!this.wsClients.has(taskId)) {
      this.wsClients.set(taskId, new Set());
    }
    this.wsClients.get(taskId)!.add(ws);
    logger.debug(`WS client subscribed to task ${taskId}`);
  }

  /**
   * Unsubscribe a WebSocket client.
   */
  unsubscribeFromProgress(taskId: string, ws: WebSocket): void {
    const clients = this.wsClients.get(taskId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.wsClients.delete(taskId);
      }
    }
  }

  /**
   * Broadcast a progress update to all subscribed WebSocket clients.
   */
  private broadcast(taskId: string, message: Record<string, unknown>): void {
    const clients = this.wsClients.get(taskId);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(data);
        } catch {
          // Client disconnected — will be cleaned up on close event
        }
      }
    }
  }

  /**
   * Execute the extraction task.
   */
  private async runTask(task: ExtractionTaskInternal): Promise<void> {
    task.status = 'running';
    logger.info(`Starting extraction task: ${task.taskId}`);

    try {
      const finalStatus = await runExtractionTask(
        {
          taskId: task.taskId,
          status: 'running',
          config: task.config,
          progress: task.progress,
          abortController: task.abortController,
        },
        // onProgress callback
        (update: ProgressUpdate) => {
          task.progress.completedSteps = update.completedSteps;
          task.progress.currentChapterIndex = update.currentChapterIndex;
          task.progress.currentChapterTitle = update.currentChapterTitle;
          task.progress.currentCategory = update.currentCategory;

          this.broadcast(task.taskId, {
            type: 'progress',
            data: update,
          });
        },
        // onMergeComplete callback
        (category: string, result: MergeResult) => {
          this.broadcast(task.taskId, {
            type: 'merge_complete',
            data: { category, ...result },
          });
        },
      );

      task.status = finalStatus.status;
      task.completedAt = new Date().toISOString();
      task.finalStatus = finalStatus;

      // Broadcast completion
      this.broadcast(task.taskId, {
        type: 'task_complete',
        data: finalStatus,
      });

      logger.info(
        `Extraction task ${task.taskId} completed with status: ${task.status}`,
      );
    } catch (err) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();

      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Extraction task ${task.taskId} failed: ${errorMsg}`);

      this.broadcast(task.taskId, {
        type: 'error',
        data: { message: errorMsg },
      });
    }
  }
}

// Singleton
let managerInstance: ExtractionManager | null = null;

export function getExtractionManager(): ExtractionManager {
  if (!managerInstance) {
    throw new Error('ExtractionManager not initialized. Call createExtractionManager() first.');
  }
  return managerInstance;
}

export function createExtractionManager(): ExtractionManager {
  managerInstance = new ExtractionManager();
  logger.info('ExtractionManager initialized');
  return managerInstance;
}
