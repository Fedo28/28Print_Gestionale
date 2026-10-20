import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../lib/print-jobs", () => ({
  authenticateBridge: vi.fn().mockResolvedValue("bridge"),
  claimPrintJob: vi.fn().mockResolvedValue(null),
  renewPrintLease: vi.fn(), beginPrintDispatch: vi.fn(), reportPrintJob: vi.fn()
}));
vi.mock("../lib/print-runtime", () => ({ assertPrintTransport: vi.fn() }));
import { POST } from "../app/api/print-bridge/route";
import { authenticateBridge, claimPrintJob, reportPrintJob } from "../lib/print-jobs";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T18:00:00Z"));
  vi.stubEnv("NIGHT_PAUSE_ENABLED", "true");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const post = (body: object) => POST(new Request("https://test.invalid/api/print-bridge", {
  method: "POST", body: JSON.stringify(body)
}));
it("vecchio Bridge: claim notturno senza autenticazione DB o interrogazione della coda", async () => {
  const response = await post({ operation: "claim", destinations: ["test"] });
  expect(await response.json()).toEqual({ job: null, pausedUntil: "2026-10-21T06:00:00.000Z" });
  expect(authenticateBridge).not.toHaveBeenCalled();
  expect(claimPrintJob).not.toHaveBeenCalled();
});
it("alle 8 il claim torna autenticato", async () => {
  vi.setSystemTime(new Date("2026-10-21T06:00:00Z"));
  await post({ operation: "claim", destinations: ["test"] });
  expect(authenticateBridge).toHaveBeenCalledTimes(1);
  expect(claimPrintJob).toHaveBeenCalledTimes(1);
});
it("le ricevute notturne restano autenticate e non vengono perse", async () => {
  const response = await post({ operation: "report", jobId: "11111111-1111-4111-8111-111111111111",
    claimToken: "22222222-2222-4222-8222-222222222222", outcome: "DELIVERED", detail: "test" });
  expect(response.status).toBe(200);
  expect(authenticateBridge).toHaveBeenCalledTimes(1);
  expect(reportPrintJob).toHaveBeenCalledTimes(1);
});
