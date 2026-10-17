import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

// Questo comando sostituisce vercel-build SOLO nella copia per il collaudo V1.
// Non modifica il build di produzione e non aggiorna utenti/catalogo esistenti.
const testProject = "prj_kVnGFsm07tPWagLGTEPcecXwqSrH";
const testBlob = "p0vcivg2nriyj0xn.public.blob.vercel-storage.com";
if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_PROJECT_ID !== testProject ||
  process.env.PRINT_BRIDGE_ENABLED !== "true" || process.env.PRINT_BRIDGE_ENVIRONMENT !== "test" ||
  process.env.PRINT_BRIDGE_BLOB_HOSTS !== testBlob || process.env.PRINT_BRIDGE_LOCAL_TEST) {
  throw Error("Build rifiutata: serve la Preview V1 verificata, mai la produzione.");
}
const url = new URL(process.env.DATABASE_URL || "");
if (url.hostname !== "db.prisma.io" || url.pathname !== "/postgres" ||
  !/^[a-f0-9]{64}$/.test(process.env.PRINT_BRIDGE_DB_FINGERPRINT || "") ||
  createHash("sha256").update(process.env.DATABASE_URL).digest("hex") !== process.env.PRINT_BRIDGE_DB_FINGERPRINT) {
  throw Error("Build rifiutata: database diverso da quello verificato in sola lettura.");
}
for (const key of ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "WEB_PUSH_VAPID_PRIVATE_KEY"]) {
  if (process.env[key]) throw Error(`Build di test rifiutata: integrazione esterna attiva (${key}).`);
}
for (const [command, args] of [
  ["npm", ["run", "deploy:check-env"]],
  ["npx", ["--no-install", "prisma", "migrate", "deploy"]],
  ["npx", ["--no-install", "next", "build"]]
]) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
