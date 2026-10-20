import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({
  headers: () => new Headers({ host: "preview.invalid" }),
  cookies: vi.fn(() => { throw Error("Session lookup should not run at night"); })
}));
vi.mock("../lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { requireAuth, authenticateUser } from "../lib/auth";
import { prisma } from "../lib/prisma";
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it("blocks staff actions even when posted to a public route, before any DB lookup", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T18:00:00Z"));
  vi.stubEnv("NIGHT_PAUSE_ENABLED", "true");
  await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT");
  await expect(authenticateUser("synthetic", "not-a-password")).rejects.toThrow("NEXT_REDIRECT");
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
