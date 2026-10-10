import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const password = readFileSync(path.join(process.cwd(), ".local-preview/db-password"), "utf8").trim();
const url = `postgresql://preview:${password}@127.0.0.1:54329/fede_personal_preview`;
const result = spawnSync(path.join(process.cwd(), "node_modules/.bin/vitest"), ["run", "tests/site-email.integration.test.ts"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, SITE_EMAIL_TEST_DATABASE_URL: url } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
