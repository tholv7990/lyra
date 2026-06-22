// A tiny in-process concurrency limiter: at most `max` `run()` callbacks execute
// at once; the rest queue FIFO and resume as slots free. Used to cap simultaneous
// yt-dlp/ffmpeg downloads so many parallel Crawler links don't overwhelm the box
// (each merge is CPU-bound). In-process only — fine for one connectors instance;
// move to a real job queue (BullMQ/Redis) if this ever scales horizontally.
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    // At capacity — wait until a release() hands us its slot (active already
    // accounts for us at that point, so we must not increment again).
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next(); // pass the slot straight to the next waiter (active unchanged)
    else this.active--; // no one waiting — free the slot
  }
}
