import { randomBytes } from "node:crypto";
import { open, mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { assertPrintEnabled } from "../lib/print-runtime";
import { tokenHash } from "../lib/print-jobs";
import { PROFILE } from "../bridge/src/protocol";

async function main() {
  assertPrintEnabled();
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ""; };
  const tokenFile = path.resolve(arg("--token-file") || ".local-print-test/bridge-token.secret");
  const relative = path.relative(process.cwd(), tokenFile);
  if (!relative.startsWith(".." + path.sep) && !relative.startsWith(".local-print-test" + path.sep)) throw new Error("Salvare la credenziale fuori dal repository oppure in .local-print-test (ignorato da Git).");
  const key = arg("--key") || "ipc650-test-a4-bn";
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)) throw new Error("Chiave destinazione non valida.");
  const token = randomBytes(32).toString("base64url");
  await mkdir(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
  const output = await open(tokenFile, "wx", 0o600);
  try {
    const rotateId = arg("--rotate-bridge");
    const bridge = rotateId
      ? await prisma.printBridge.update({ where: { id: rotateId }, data: { tokenHash: tokenHash(token), enabled: true } })
      : await prisma.printBridge.create({ data: { name: arg("--name") || "PC negozio - prova IPC650", tokenHash: tokenHash(token), destinations: { create: {
        key, name: "28PRINT_TEST_A4_BN", printerName: "Canon IPC650 / G100", profileKey: PROFILE,
        printer: { create: { name: "Canon IPC650 / G100" } },
        profile: { connectOrCreate: { where: { key: PROFILE }, create: { key: PROFILE, name: "A4 B/N · solo fronte · 1 copia · attesa", paperSize: "A4", colorMode: "BW", sides: "SIMPLEX" } } }
      } } } });
    await output.writeFile(token); await output.sync();
    console.log(`Bridge registrato: ${bridge.id}. Credenziale salvata nel file locale protetto; non copiarla in chat. Destinazione: ${key}.`);
  } finally { await output.close(); }
}
main().catch(() => { console.error("Provisioning non completato. Verificare ambiente di test, database, chiave destinazione univoca e file credenziale non esistente."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
