// Attach rejection handling immediately. Coalescing is for complete state
// snapshots only: callers that need every individual write retain FIFO behavior.
export function progressWriter(write, {coalesce = false} = {}) {
  let queue = Promise.resolve(), failure, pending, draining = false;
  return {
    record(value) {
      if (failure) throw failure;
      if (!coalesce) {
        queue = queue.then(() => { if (!failure) return write(value); }).catch(error => { failure = error; });
        return;
      }
      pending = {value};
      if (draining) return;
      draining = true;
      queue = (async () => {
        try {
          while (pending && !failure) {
            const next = pending; pending = undefined;
            await write(next.value);
          }
        } catch (error) { failure = error; pending = undefined; }
        finally { draining = false; }
      })();
    },
    async flush() { await queue; if (failure) throw failure; },
    async settle() { await queue; },
  };
}
