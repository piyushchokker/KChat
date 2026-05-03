type WorkerTask = {
  name: string;
  run: () => Promise<void>;
  enqueuedAt: number;
};

class BackgroundWorker {
  private readonly queue: WorkerTask[] = [];
  private running = 0;
  private readonly concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue(name: string, run: () => Promise<void>) {
    this.queue.push({
      name,
      run,
      enqueuedAt: Date.now(),
    });
    this.drain();
  }

  private drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) return;

      this.running += 1;

      void (async () => {
        try {
          await task.run();
        } catch (error) {
          console.error("[background-worker] task failed", {
            task: task.name,
            queuedForMs: Date.now() - task.enqueuedAt,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          this.running -= 1;
          this.drain();
        }
      })();
    }
  }

  getStats() {
    return {
      pending: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }
}

declare global {
  var __kchatBackgroundWorker: BackgroundWorker | undefined;
}

function getWorkerConcurrency(): number {
  const raw = process.env.CHAT_BACKGROUND_WORKER_CONCURRENCY;
  if (!raw) return 4;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

export function getBackgroundWorker(): BackgroundWorker {
  if (!globalThis.__kchatBackgroundWorker) {
    globalThis.__kchatBackgroundWorker = new BackgroundWorker(
      getWorkerConcurrency()
    );
  }
  return globalThis.__kchatBackgroundWorker;
}
