type PollOptions = { intervalMs: number; immediate?: boolean };

// Browser-only lifecycle. Hidden/offline tabs do no work and slow requests never overlap.
export function startVisiblePolling(task: (signal: AbortSignal) => void | Promise<void>, options: PollOptions) {
  let stopped = false;
  let pending = false;
  let lastStarted = options.immediate === false ? Date.now() : -Infinity;
  const controller = new AbortController();
  const poll = async () => {
    if (stopped || pending || document.documentElement?.dataset.nightPause === "true" ||
      document.visibilityState !== "visible" || !navigator.onLine ||
      Date.now() - lastStarted < options.intervalMs) return;
    pending = true;
    lastStarted = Date.now();
    try { await task(controller.signal); }
    catch { /* A transient failure must not create an unhandled rejection or a retry loop. */ }
    finally { pending = false; }
  };
  const wake = () => { void poll(); };
  const timer = window.setInterval(wake, options.intervalMs);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  if (options.immediate !== false) wake();
  return () => {
    stopped = true;
    controller.abort();
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
    window.removeEventListener("online", wake);
  };
}
