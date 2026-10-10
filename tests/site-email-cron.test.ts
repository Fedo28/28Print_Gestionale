import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../lib/site-email", () => ({ processSiteEmailReminders: vi.fn(async () => ({ blocked: true, sent: 0 })) }));
import { processSiteEmailReminders } from "../lib/site-email";
import { GET } from "../app/api/cron/site-renewal-reminders/route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("site email cron authentication", () => {
  it("rejects unauthenticated requests and missing secrets without running the worker", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new NextRequest("https://example.invalid/api/cron/site-renewal-reminders", { headers: { authorization: "Bearer undefined" } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "secure-test-secret-at-least-16");
    expect((await GET(new NextRequest("https://example.invalid/api/cron/site-renewal-reminders"))).status).toBe(401);
    expect(processSiteEmailReminders).not.toHaveBeenCalled();
  });
  it("accepts only the configured cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secure-test-secret-at-least-16");
    const response = await GET(new NextRequest("https://example.invalid/api/cron/site-renewal-reminders", { headers: { authorization: "Bearer secure-test-secret-at-least-16" } }));
    expect(response.status).toBe(200); expect(processSiteEmailReminders).toHaveBeenCalledOnce(); expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
