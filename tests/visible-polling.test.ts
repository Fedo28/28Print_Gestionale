import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "../lib/visible-polling";

let page: EventTarget & { visibilityState: string };
let browser: EventTarget;
let connection: { onLine: boolean };
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  connection = { onLine: true };
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("navigator", connection);
});
afterEach(() => { stop?.(); stop = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("visible polling", () => {
  it("pauses browser refresh during night suspension and resumes afterwards", async () => {
    const documentElement = { dataset: { nightPause: "true" } };
    Object.assign(page, { documentElement });
    const task = vi.fn();
    stop = startVisiblePolling(task, { intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).not.toHaveBeenCalled();
    documentElement.dataset.nightPause = "false";
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(1);
  });
  it("does no background work and refreshes when a stale hidden tab becomes visible", async () => {
    const task = vi.fn();
    page.visibilityState = "hidden";
    stop = startVisiblePolling(task, { intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
  });
  it("does not overlap slow requests and aborts them on disposal", async () => {
    const task = vi.fn((_signal: AbortSignal) => new Promise<void>(() => {}));
    stop = startVisiblePolling(task, { intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).toHaveBeenCalledTimes(1);
    const signal = task.mock.calls[0][0];
    stop();
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(1);
  });
  it("waits for the first interval for server-rendered content, pauses offline and resumes online", async () => {
    const task = vi.fn();
    stop = startVisiblePolling(task, { intervalMs: 60_000, immediate: false });
    browser.dispatchEvent(new Event("focus"));
    expect(task).not.toHaveBeenCalled();
    connection.onLine = false;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).not.toHaveBeenCalled();
    connection.onLine = true;
    browser.dispatchEvent(new Event("online"));
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
  });
  it("retries a failure at the normal interval without a tight loop", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    stop = startVisiblePolling(task, { intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
