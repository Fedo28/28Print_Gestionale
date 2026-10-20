import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const database = "postgres://synthetic:synthetic@db.prisma.io/postgres";
const baseline = {
  VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "prj_kVnGFsm07tPWagLGTEPcecXwqSrH",
  PRINT_BRIDGE_ENABLED: "true", PRINT_BRIDGE_ENVIRONMENT: "test", PRINT_BRIDGE_LOCAL_TEST: "",
  PRINT_BRIDGE_BLOB_HOSTS: "p0vcivg2nriyj0xn.public.blob.vercel-storage.com",
  DATABASE_URL: database, PRINT_BRIDGE_DB_FINGERPRINT: createHash("sha256").update(database).digest("hex"),
  RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", WEB_PUSH_VAPID_PRIVATE_KEY: ""
};
describe("guardia build Preview V1 prima di qualsiasi migrazione", () => {
  it.each([
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: "prj_other" },
    { PRINT_BRIDGE_BLOB_HOSTS: "other.public.blob.vercel-storage.com" },
    { DATABASE_URL: "postgres://synthetic:synthetic@other.invalid/postgres" },
    { PRINT_BRIDGE_DB_FINGERPRINT: "0".repeat(64) },
    { RESEND_API_KEY: "synthetic-key" }
  ])("rifiuta parametri non verificati: %j", overrides => {
    const result = spawnSync(process.execPath, [path.resolve("scripts/build-print-preview.mjs")], {
      env: { ...process.env, ...baseline, ...overrides }, encoding: "utf8"
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("prisma");
    expect(result.stderr).toContain("rifiutata");
    expect(result.stderr).not.toContain(database);
  });
});
