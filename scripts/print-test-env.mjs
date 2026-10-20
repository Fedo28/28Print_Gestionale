import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export function printTestEnv() {
  const config = JSON.parse(readFileSync(path.join(process.cwd(), ".local-print-test/environment.json"), "utf8"));
  const url = new URL(config.databaseUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "54339" || url.pathname !== "/fede_print_bridge_test") throw Error("Test consentiti solo sul database locale dedicato.");
  const env = { ...process.env, DATABASE_URL: config.databaseUrl, PRINT_BRIDGE_TEST_DATABASE_URL: config.databaseUrl,
    PRINT_BRIDGE_ENABLED: "true", PRINT_BRIDGE_ENVIRONMENT: "test", PRINT_BRIDGE_LOCAL_TEST: "true",
    GESTIONALE_LOCAL_PREVIEW: "true", AUTH_SECRET: config.authSecret, NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
    PRINT_BRIDGE_BLOB_HOSTS: "", BLOB_READ_WRITE_TOKEN: "", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "",
    WEB_PUSH_VAPID_PRIVATE_KEY: "", WEB_PUSH_VAPID_PUBLIC_KEY: "", NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "",
    SITE_RENEWAL_EMAILS_ENABLED: "false", CRON_SECRET: "", SHOP_BETA_LOCKED: "false" };
  return { env, config };
}
export async function verifyPrintTestIsolation() {
  const { env, config } = printTestEnv();
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    const [row] = await db.$queryRawUnsafe("SELECT host(inet_server_addr()) AS address, inet_server_port() AS port, current_setting('data_directory') AS dir");
    if (row.address !== "127.0.0.1" || Number(row.port) !== 54339 || realpathSync(row.dir) !== realpathSync(config.clusterPath)) throw Error("Database non corrispondente al cluster isolato.");
    if (env.BLOB_READ_WRITE_TOKEN || env.PRINT_BRIDGE_BLOB_HOSTS) throw Error("Storage cloud vietato nei test locali.");
    console.log("Isolamento verificato: PostgreSQL locale dedicato, upload locali, integrazioni esterne disabilitate.");
  } finally { await db.$disconnect(); }
  return env;
}
