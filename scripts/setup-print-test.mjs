import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.join(process.cwd(), ".local-print-test");
mkdirSync(root, { recursive: true, mode: 0o700 });
const configFile = path.join(root, "environment.json");
const previous = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
const adopted = option("--adopt-runtime");
const previousRuntime = previous.runtimePath || (previous.clusterPath && existsSync(path.join(path.dirname(previous.clusterPath), "node_modules/@embedded-postgres/darwin-arm64")) ? path.dirname(previous.clusterPath) : undefined);
const runtime = adopted || previousRuntime || path.join(root, "runtime");
const passwordSource = option("--password-file");
const passwordFile = path.join(root, "db-password");
if (!existsSync(passwordFile)) writeFileSync(passwordFile, passwordSource ? readFileSync(passwordSource) : randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
const password = readFileSync(passwordFile, "utf8").trim();
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error || result.status !== 0) throw Error(`Preparazione fallita: ${path.basename(command)}`);
}
if (process.platform !== "darwin" || process.arch !== "arm64") throw Error("Setup locale automatico disponibile su macOS Apple Silicon; il Bridge Windows ha una guida separata.");
const bin = path.join(runtime, "node_modules/@embedded-postgres/darwin-arm64/native/bin");
if (!existsSync(bin)) run("npm", ["install", "--prefix", runtime, "@embedded-postgres/darwin-arm64@18.4.0-beta.17", "pg@8"]);
const clusterPath = adopted ? path.join(adopted, "pgdata") : previous.clusterPath || path.join(root, "pgdata");
if (!existsSync(path.join(clusterPath, "PG_VERSION"))) run(path.join(bin, "initdb"), ["-D", clusterPath, "-U", "bridge_test", "--pwfile", passwordFile, "--auth-host=scram-sha-256", "--auth-local=scram-sha-256", "--encoding=UTF8", "--locale=C"]);
if (spawnSync(path.join(bin, "pg_ctl"), ["-D", clusterPath, "status"], { stdio: "ignore" }).status !== 0) run(path.join(bin, "pg_ctl"), ["-D", clusterPath, "-l", path.join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p 54339 -k ${runtime}`, "-w", "start"]);
const { Client } = require(path.join(runtime, "node_modules/pg"));
const client = new Client({ host: "127.0.0.1", port: 54339, user: "bridge_test", password, database: "postgres" });
await client.connect();
try {
  const { rows: [row] } = await client.query("SELECT current_setting('data_directory') AS dir");
  const { realpathSync } = await import("node:fs");
  if (realpathSync(row.dir) !== realpathSync(clusterPath)) throw Error("Porta occupata da un cluster differente: nessuna migrazione eseguita.");
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", ["fede_print_bridge_test"])).rowCount) await client.query('CREATE DATABASE "fede_print_bridge_test"');
} finally { await client.end(); }
const authSecret = previous.authSecret || randomBytes(32).toString("hex");
writeFileSync(configFile, JSON.stringify({ databaseUrl: `postgresql://bridge_test:${password}@127.0.0.1:54339/fede_print_bridge_test`, authSecret, clusterPath, runtimePath: runtime }), { mode: 0o600 });
const { verifyPrintTestIsolation } = await import("./print-test-env.mjs");
const env = await verifyPrintTestIsolation();
run(path.join(process.cwd(), "node_modules/.bin/prisma"), ["migrate", "deploy"], env);
console.log("Ambiente pronto. Nessuna connessione alla produzione.");
