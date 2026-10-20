import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth-core";
import { isLocalPrintTest } from "../lib/print-runtime";
import { tokenHash } from "../lib/print-jobs";
import { PROFILE } from "../bridge/src/protocol";

async function main() {
  if (!isLocalPrintTest()) throw new Error("Seed consentito solo nel database locale dedicato.");
  const root = path.join(process.cwd(), ".local-print-test");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const secretPath = path.join(root, "access.json");
  const secrets = await readFile(secretPath, "utf8").then(JSON.parse).catch(() => ({ password: randomBytes(20).toString("base64url"), bridgeToken: randomBytes(32).toString("base64url") }));
  await writeFile(secretPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  await prisma.user.upsert({ where: { id: "print-test-admin" }, update: {}, create: { id: "print-test-admin", nickname: "bridge-test", name: "Amministratore prova Bridge", email: "bridge-test@example.invalid", passwordHash: hashPassword(secrets.password), role: "ADMIN" } });
  await prisma.customer.upsert({ where: { id: "print-test-customer" }, update: {}, create: { id: "print-test-customer", name: "Cliente sintetico - prova Bridge" } });
  await prisma.order.upsert({ where: { id: "print-test-order" }, update: {}, create: { id: "print-test-order", customerId: "print-test-customer", orderCode: "28PRINT-TEST", title: "Prova IPC650 - nessuna stampa automatica", titleNormalized: "prova-bridge", createdOn: "2026-10-15", deliveryAt: new Date("2026-10-20T12:00:00Z") } });
  const fixture = await readFile(path.join(process.cwd(), "output/pdf/28print-fiery-test-a4.pdf"));
  const directory = path.join(process.cwd(), "public/uploads/orders/print-test-order");
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, "test-a4.pdf"), fixture);
  await prisma.attachment.upsert({ where: { id: "print-test-attachment" }, update: {}, create: { id: "print-test-attachment", orderId: "print-test-order", fileName: "28print-fiery-test-a4.pdf", filePath: "/uploads/orders/print-test-order/test-a4.pdf", mimeType: "application/pdf", sizeBytes: fixture.length } });
  await prisma.printBridge.upsert({ where: { id: "print-test-bridge" }, update: {}, create: { id: "print-test-bridge", name: "Simulatore locale - nessuna stampante", tokenHash: tokenHash(secrets.bridgeToken), destinations: { create: {
    key: "ipc650-test-a4-bn", name: "Cartella simulata", printerName: "IPC650 simulata", profileKey: PROFILE,
    printer: { create: { name: "IPC650 simulata", preferredFor: "COLOR" } },
    profile: { connectOrCreate: { where: { key: PROFILE }, create: { key: PROFILE, name: "A4 B/N · solo fronte · 1 copia · attesa", paperSize: "A4", colorMode: "BW", sides: "SIMPLEX" } } }
  } } } });
  const seededDestination = await prisma.printDestination.findFirstOrThrow({ where: { bridgeId: "print-test-bridge", key: "ipc650-test-a4-bn" } });
  if (seededDestination.printerId && seededDestination.profileId) {
    await prisma.printPrinter.update({ where: { id: seededDestination.printerId }, data: { enabled: true } });
    await prisma.printProfile.update({ where: { id: seededDestination.profileId }, data: { enabled: true } });
    await prisma.printDestination.update({ where: { id: seededDestination.id }, data: { enabled: true } });
  }
  console.log("Ordine sintetico pronto: /orders/print-test-order. Credenziali esclusivamente in .local-print-test/access.json.");
}
main().catch(() => { console.error("Seed locale non riuscito."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
