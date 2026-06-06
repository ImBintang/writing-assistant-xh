// server/src/utils/mutex.ts
// Promise-based mutex and task queue for concurrency control.
// Ensures same-function tasks execute sequentially while different
// function types can run in parallel.

const logger = console; // Lightweight — don't import winston to avoid circular deps

/**
 * Simple Promise-based Mutex.
 * Guarantees mutual exclusion for async operations.
 */
export class Mutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  /**
   * Acquire the mutex lock.
   * Returns immediately if unlocked, otherwise waits for release.
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Queue up and wait
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  /**
   * Release the mutex lock.
   * Wakes the next waiter in the queue, if any.
   */
  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      // next() sets locked = true
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Run a function exclusively, acquiring and releasing the lock automatically.
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Check if the mutex is currently locked.
   */
  get isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Task queue for per-function-type serialization.
 *
 * Tasks of the same type execute sequentially.
 * Tasks of different types execute concurrently.
 * This means: only one extraction at a time, but extraction + writing can run together.
 */
export class TaskQueue {
  private queues = new Map<string, Mutex>();

  private getMutex(type: string): Mutex {
    let mutex = this.queues.get(type);
    if (!mutex) {
      mutex = new Mutex();
      this.queues.set(type, mutex);
    }
    return mutex;
  }

  /**
   * Enqueue a task for execution.
   *
   * @param type - Function type identifier (e.g., 'extract', 'write', 'brainstorm')
   * @param task - Async function to execute
   * @returns The task's return value
   */
  async enqueue<T>(type: string, task: () => Promise<T>): Promise<T> {
    const mutex = this.getMutex(type);
    logger.log(`[TaskQueue] Enqueuing task type="${type}", waiting=${mutex.isLocked ? 'yes' : 'no'}`);
    return mutex.runExclusive(task);
  }

  /**
   * Check if a task of the given type is currently running.
   */
  isRunning(type: string): boolean {
    const mutex = this.queues.get(type);
    return mutex ? mutex.isLocked : false;
  }

  /**
   * Get the count of queued function types.
   */
  get activeTypes(): string[] {
    return Array.from(this.queues.entries())
      .filter(([, mutex]) => mutex.isLocked)
      .map(([type]) => type);
  }
}

// Singleton task queue instance
let taskQueueInstance: TaskQueue | null = null;

export function getTaskQueue(): TaskQueue {
  if (!taskQueueInstance) {
    taskQueueInstance = new TaskQueue();
  }
  return taskQueueInstance;
}
