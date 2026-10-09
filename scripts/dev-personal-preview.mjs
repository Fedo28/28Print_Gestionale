import { createRequire } from "node:module";
import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const sourceUrl = process.env.DATABASE_URL;
const root = path.join(process.cwd(), ".local-preview");
const runtime = "/tmp/gestionale-personal-runtime";
const dbPort = 54329;
const webPort = Number(process.argv[2] || 3001);
mkdirSync(root, { recursive: true, mode: 0o700 });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error || result.status !== 0) throw new Error(`Comando anteprima non riuscito: ${path.basename(command)}`);
}

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("Questo avvio locale usa PostgreSQL per macOS Apple Silicon. Su altri sistemi configura un database locale e usa npm run setup.");
}
const binaryPackage = path.join(runtime, "node_modules/@embedded-postgres/darwin-arm64");
if (!existsSync(binaryPackage) || !existsSync(path.join(runtime, "node_modules/pg"))) {
  run("npm", ["install", "--prefix", runtime, "--cache", "/tmp/gestionale-npm-cache", "@embedded-postgres/darwin-arm64@18.4.0-beta.17", "pg@8"]);
}
const bin = path.join(binaryPackage, "native/bin");
const passwordFile = path.join(root, "db-password");
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString("hex"), { mode: 0o600 });
const password = readFileSync(passwordFile, "utf8").trim();
const dataDir = path.join(root, "pgdata");
if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  run(path.join(bin, "initdb"), ["-D", dataDir, "-U", "preview", "--pwfile", passwordFile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
}
const status = spawnSync(path.join(bin, "pg_ctl"), ["-D", dataDir, "status"], { stdio: "ignore" });
if (status.status !== 0) {
  run(path.join(bin, "pg_ctl"), ["-D", dataDir, "-l", path.join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${dbPort} -k /tmp`, "-w", "start"]);
}
const { Client, types } = require(path.join(runtime, "node_modules/pg"));
types.setTypeParser(1114, (value) => value);
const baseConnection = { host: "127.0.0.1", port: dbPort, user: "preview", password };
const admin = new Client({ ...baseConnection, database: "postgres" });
await admin.connect();
const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", ["fede_personal_preview"]);
if (!found.rowCount) await admin.query('CREATE DATABASE "fede_personal_preview"');
await admin.end();

const localUrl = `postgresql://preview:${password}@127.0.0.1:${dbPort}/fede_personal_preview`;
const previewEnv = { ...process.env, DATABASE_URL: localUrl, GESTIONALE_LOCAL_PREVIEW: "true" };
// The copied database includes subscriptions and shop records. Preview actions
// must use local storage and must not send mail, push messages or Stripe requests.
for (const name of ["BLOB_READ_WRITE_TOKEN", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_PUBLIC_KEY", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY"]) previewEnv[name] = "";
run(path.join(process.cwd(), "node_modules/.bin/prisma"), ["migrate", "deploy"], { env: previewEnv });

const marker = path.join(root, "copied-from-source");
if (!existsSync(marker)) {
  if (!sourceUrl) throw new Error("Manca il database da copiare per l'anteprima.");
  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({ ...baseConnection, database: "fede_personal_preview" });
  await source.connect();
  await target.connect();
  const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = await source.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name");
    await target.query("BEGIN");
    await target.query("SET LOCAL session_replication_role = replica");
    for (const { table_name: name } of tables.rows) {
      const rows = await source.query(`SELECT * FROM ${quote(name)}`);
      if (!rows.rowCount) continue;
      const columns = rows.fields.map((field) => field.name);
      const statement = `INSERT INTO ${quote(name)} (${columns.map(quote).join(",")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})`;
      for (const row of rows.rows) await target.query(statement, columns.map((column) => row[column]));
    }
    await target.query("COMMIT");
    await source.query("COMMIT");
    writeFileSync(marker, new Date().toISOString(), { mode: 0o600 });
    console.log("Copia locale pronta. Le prove vengono salvate solo nel database locale.");
  } catch (error) {
    await target.query("ROLLBACK");
    await source.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}
console.log(`Anteprima isolata: http://localhost:${webPort}`);
const child = spawn(path.join(process.cwd(), "node_modules/.bin/next"), ["dev", "--hostname", "127.0.0.1", "--port", String(webPort)], { env: previewEnv, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
