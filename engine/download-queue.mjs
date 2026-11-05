// Shared across page workers: one host cannot consume all download slots.
export class DownloadQueue {
  constructor({concurrency = 12, perHost = 6} = {}) {
    this.limit = Math.max(1, Math.min(32, Number(concurrency) || 12));
    this.perHost = Math.max(1, Math.min(this.limit, Number(perHost) || 6));
    this.active = 0; this.hosts = new Map(); this.pending = [];
  }
  run(origin, task) {
    return new Promise((resolve, reject) => {
      this.pending.push({origin, task, resolve, reject}); this.drain();
    });
  }
  drain() {
    while (this.active < this.limit) {
      const index = this.pending.findIndex(x => (this.hosts.get(x.origin) || 0) < this.perHost);
      if (index < 0) return;
      const item = this.pending.splice(index, 1)[0];
      this.active++; this.hosts.set(item.origin, (this.hosts.get(item.origin) || 0) + 1);
      Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(() => {
        this.active--; this.hosts.set(item.origin, this.hosts.get(item.origin) - 1); this.drain();
      });
    }
  }
}
