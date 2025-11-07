export class ExecutionQueue {
  private active = 0;

  constructor(private readonly limit: number) {
    if (limit <= 0 || !Number.isFinite(limit)) {
      throw new Error('Execution queue limit must be a positive number.');
    }
  }

  isSaturated(): boolean {
    return this.active >= this.limit;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      throw new Error('Execution queue is saturated');
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active = Math.max(0, this.active - 1);
    }
  }

  reset(): void {
    this.active = 0;
  }
}
