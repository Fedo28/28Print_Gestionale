import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrintJob, type PrintJobStatus, type PrintSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPrintEnabled } from "@/lib/print-runtime";
import { readPrintSource } from "@/lib/print-source";
import { PROFILE, type PrintManifest, type Report } from "@/bridge/src/protocol";
import { destinationUnavailable, profileDescription } from "@/lib/print-profiles";
import { lockPrintSettings } from "@/lib/print-settings-lock";

const LEASE_MS = 120000;
export const printStatusLabels: Record<PrintJobStatus, string> = {
  APPROVED: "Approvato", PREPARING: "In preparazione", SENDING: "In invio a Fiery",
  DELIVERED: "Consegnato alla Hot Folder", ERROR: "Errore", NEEDS_REVIEW: "Da verificare",
  PRINTED: "Stampato (confermato manualmente)", CANCELLED: "Annullato"
};
export const printSourceLabels: Record<PrintSourceType, string> = {
  ORDER_ATTACHMENT: "Allegato ordine",
  SHOP_FILE: "Banco Online",
  WHATSAPP_MEDIA: "WhatsApp",
  INTERNAL_DOCUMENT: "Lavorazione interna"
};
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
type Tx = Prisma.TransactionClient;
type ApprovedPrintSource = {
  type: PrintSourceType;
  id: string;
  orderId?: string;
  attachmentId?: string;
  orderCode: string;
  fileName: string;
  sourcePath: string;
  fileSize: number;
  sha256: string;
  pageCount: number;
};

function printRequestKey(source: ApprovedPrintSource, reprintOfId?: string) {
  if (reprintOfId) return `reprint:${reprintOfId}`;
  // Keep the Phase 2 key stable so a migration cannot create a second job for an already approved attachment.
  if (source.type === "ORDER_ATTACHMENT") return `original:${source.id}:${source.sha256}`;
  return `original:${source.type}:${source.id}:${source.sha256}`;
}

async function event(tx: Tx, jobId: string, key: string, type: string, detail: string, actorId?: string) {
  await tx.printJobEvent.upsert({ where: { key }, update: {}, create: { jobId, key, type, detail, actorId } });
}
export async function assertPrintAdmin(userId: string) {
  assertPrintEnabled();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, active: true, role: true } });
  if (!user?.active || user.role !== "ADMIN") throw new Error("Solo un amministratore attivo può autorizzare i lavori Fiery.");
  return user;
}
export async function authenticateBridge(authorization: string | null) {
  assertPrintEnabled();
  if (!authorization || !/^Bearer [A-Za-z0-9_-]{43,128}$/.test(authorization)) throw new Error("Bridge non autorizzato.");
  const bridge = await prisma.printBridge.findUnique({ where: { tokenHash: tokenHash(authorization.slice(7)) }, select: { id: true, enabled: true } });
  if (!bridge?.enabled) throw new Error("Bridge non autorizzato.");
  return bridge.id;
}
export async function reviewPrintAttachment(userId: string, orderId: string, attachmentId: string) {
  await assertPrintAdmin(userId);
  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, orderId }, include: { order: { select: { id: true, orderCode: true, isQuote: true } } } });
  if (!attachment || attachment.order.isQuote || !attachment.fileName.toLowerCase().endsWith(".pdf")) throw new Error("Seleziona un PDF allegato a un ordine interno.");
  const source = await readPrintSource(attachment.filePath);
  return { attachment, ...source };
}

async function createApprovedPrintJob(tx: Tx, input: {
  source: ApprovedPrintSource;
  destinationId: string;
  actor: { id: string; name: string };
  reprintOfId?: string;
  reason?: string;
}) {
  const { source, actor } = input;
  const requestKey = printRequestKey(source, input.reprintOfId);
  const existing = await tx.printJob.findUnique({ where: { requestKey } });
  if (existing) return existing.id;
  await lockPrintSettings(tx);
  const destination = await tx.printDestination.findUnique({ where: { id: input.destinationId }, include: { bridge: true, printer: true, profile: true } });
  if (!destination || destinationUnavailable(destination)) throw new Error("Stampante, profilo o destinazione non disponibili. Ricarica la selezione prima di approvare.");
  const reason = (input.reason || "").trim().slice(0, 500);
  if (input.reprintOfId) {
    await tx.$queryRaw`SELECT "id" FROM "PrintJob" WHERE "id" = ${input.reprintOfId} FOR UPDATE`;
    const parent = await tx.printJob.findUnique({ where: { id: input.reprintOfId } });
    if (!parent || parent.sourceType !== source.type || parent.sourceId !== source.id || parent.sha256 !== source.sha256 ||
      !["DELIVERED", "PRINTED", "ERROR", "CANCELLED"].includes(parent.status) || reason.length < 8) {
      throw new Error("Nuovo invio non consentito: prima risolvi gli esiti incerti e indica il motivo.");
    }
  }
  const job = await tx.printJob.create({ data: {
    requestKey, sourceType: source.type, sourceId: source.id, orderId: source.orderId, attachmentId: source.attachmentId,
    orderCode: source.orderCode, fileName: source.fileName, sourcePath: source.sourcePath, fileSize: source.fileSize,
    sha256: source.sha256, pageCount: source.pageCount, profileKey: destination.profileKey, destinationId: destination.id,
    approvedById: actor.id, approvedByName: actor.name, reprintOfId: input.reprintOfId, reason
  } });
  await event(tx, job.id, `approved:${job.id}`, "APPROVED", `${destination.printer!.name} · ${profileDescription(destination.profile!)}${reason ? ` · ${reason}` : ""}`, actor.id);
  return job.id;
}

export async function approvePrint(input: { userId: string; orderId: string; attachmentId: string; destinationId: string; sha256: string; reprintOfId?: string; reason?: string }) {
  const reviewed = await reviewPrintAttachment(input.userId, input.orderId, input.attachmentId);
  if (reviewed.sha256 !== input.sha256) throw new Error("Il documento è cambiato: apri nuovamente la revisione prima di approvare.");
  const actor = await assertPrintAdmin(input.userId);
  return prisma.$transaction(async tx => {
    // Serialize approvals for the same source, including simultaneous clicks from different devices.
    await tx.$queryRaw`SELECT "id" FROM "Attachment" WHERE "id" = ${input.attachmentId} FOR UPDATE`;
    const current = await tx.attachment.findUnique({ where: { id: input.attachmentId } });
    if (!current || current.filePath !== reviewed.attachment.filePath) throw new Error("L'allegato è cambiato o è stato eliminato.");
    return createApprovedPrintJob(tx, {
      actor, destinationId: input.destinationId, reprintOfId: input.reprintOfId, reason: input.reason,
      source: { type: "ORDER_ATTACHMENT", id: input.attachmentId, orderId: input.orderId, attachmentId: input.attachmentId,
        orderCode: reviewed.attachment.order.orderCode, fileName: reviewed.attachment.fileName,
        sourcePath: reviewed.attachment.filePath, fileSize: reviewed.fileSize,
        sha256: reviewed.sha256, pageCount: reviewed.pageCount }
    });
  });
}

function manifest(job: PrintJob, destinationKey: string): PrintManifest {
  return { id: job.id, claimToken: job.claimToken!, sha256: job.sha256, fileSize: job.fileSize, destinationKey, profileKey: job.profileKey };
}
async function assertBridgeActive(tx: Tx, bridgeId: string) {
  const bridge = await tx.printBridge.findUnique({ where: { id: bridgeId } });
  if (!bridge?.enabled) throw new Error("Bridge non autorizzato.");
}
export async function claimPrintJob(bridgeId: string, keys: string[]) {
  assertPrintEnabled();
  const now = new Date();
  const supported = [...new Set(keys)].filter(key => /^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)).slice(0, 20);
  return prisma.$transaction(async tx => {
    await assertBridgeActive(tx, bridgeId);
    await tx.printBridge.update({ where: { id: bridgeId }, data: { lastSeenAt: now } });
    // Prisma DateTime columns are UTC timestamp-without-zone; raw Date parameters are timestamptz.
    // Normalize explicitly so a non-UTC PostgreSQL session cannot expire a fresh lease.
    const stale = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PrintJob" WHERE "claimedById" = ${bridgeId} AND "status" = 'SENDING' AND "sendingAt" < (${new Date(now.getTime() - 600000)}::timestamptz AT TIME ZONE 'UTC') FOR UPDATE SKIP LOCKED`;
    for (const row of stale) {
      await tx.printJob.update({ where: { id: row.id }, data: { status: "NEEDS_REVIEW", lastError: "Invio senza ricevuta: controllare Fiery prima di autorizzare altri invii.", version: { increment: 1 } } });
      await event(tx, row.id, `stale:${row.id}`, "NEEDS_REVIEW", "Nessuna ricevuta entro 10 minuti.");
    }
    if (!supported.length) return null;
    const rows = await tx.$queryRaw<{ id: string; key: string }[]>`
      SELECT j."id", d."key" FROM "PrintJob" j JOIN "PrintDestination" d ON d."id" = j."destinationId"
      JOIN "PrintPrinter" p ON p."id" = d."printerId" JOIN "PrintProfile" f ON f."id" = d."profileId"
      WHERE d."bridgeId" = ${bridgeId} AND d."enabled" = true AND d."profileKey" = ${PROFILE}
      AND p."enabled" = true AND f."enabled" = true AND f."key" = d."profileKey" AND j."profileKey" = d."profileKey"
      AND f."paperSize" = 'A4' AND f."colorMode" = 'BW' AND f."sides" = 'SIMPLEX' AND f."copies" = 1 AND f."paperStock" = ''
      AND d."key" IN (${Prisma.join(supported)})
      AND (j."status" = 'APPROVED' OR (j."status" = 'PREPARING' AND j."leaseExpiresAt" < (${now}::timestamptz AT TIME ZONE 'UTC')))
      ORDER BY j."approvedAt" ASC LIMIT 1 FOR UPDATE OF j SKIP LOCKED`;
    if (!rows[0]) return null;
    const job = await tx.printJob.update({ where: { id: rows[0].id }, data: {
      status: "PREPARING", claimedById: bridgeId, claimToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      attempts: { increment: 1 }, version: { increment: 1 }, lastError: ""
    } });
    await event(tx, job.id, `claim:${job.claimToken}`, "PREPARING", "Presa in carico esclusiva del Bridge.", bridgeId);
    return manifest(job, rows[0].key);
  });
}

async function lockedJob(tx: Tx, bridgeId: string, jobId: string, claimToken: string) {
  await assertBridgeActive(tx, bridgeId);
  await tx.$queryRaw`SELECT "id" FROM "PrintJob" WHERE "id" = ${jobId} FOR UPDATE`;
  const job = await tx.printJob.findUnique({ where: { id: jobId }, include: { destination: { include: { printer: true, profile: true, bridge: true } } } });
  if (!job || job.claimedById !== bridgeId || job.claimToken !== claimToken || job.destination.bridgeId !== bridgeId) throw new Error("Assegnazione non valida o superata.");
  return job;
}
export async function renewPrintLease(bridgeId: string, jobId: string, claimToken: string) {
  assertPrintEnabled();
  return prisma.$transaction(async tx => {
    const job = await lockedJob(tx, bridgeId, jobId, claimToken);
    if (job.status !== "PREPARING" || !job.leaseExpiresAt || job.leaseExpiresAt.getTime() <= Date.now()) throw new Error("Assegnazione scaduta.");
    await tx.printJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } });
  });
}
export async function beginPrintDispatch(bridgeId: string, jobId: string, claimToken: string, dispatchId: string) {
  assertPrintEnabled();
  return prisma.$transaction(async tx => {
    await lockPrintSettings(tx);
    const job = await lockedJob(tx, bridgeId, jobId, claimToken);
    if (job.status === "SENDING" && job.dispatchId === dispatchId) return;
    if (destinationUnavailable(job.destination) || job.profileKey !== job.destination.profileKey || job.status !== "PREPARING" || !job.leaseExpiresAt || job.leaseExpiresAt.getTime() <= Date.now()) throw new Error("Invio non autorizzato o assegnazione scaduta.");
    await tx.printJob.update({ where: { id: job.id }, data: { status: "SENDING", dispatchId, sendingAt: new Date(), leaseExpiresAt: null, version: { increment: 1 } } });
    await event(tx, job.id, `begin:${dispatchId}`, "SENDING", "Autorizzato un solo deposito. Nessuna riassegnazione automatica.", bridgeId);
  });
}
export async function getPrintDownload(bridgeId: string, jobId: string, claimToken: string) {
  assertPrintEnabled();
  const job = await prisma.printJob.findFirst({ where: { id: jobId, claimedById: bridgeId, claimToken, status: "PREPARING", leaseExpiresAt: { gt: new Date() }, destination: { bridgeId, enabled: true, bridge: { enabled: true }, printer: { enabled: true }, profile: { enabled: true } } } });
  if (!job) throw new Error("Download non autorizzato.");
  if (job.sourceType !== "ORDER_ATTACHMENT") throw new Error("Sorgente non ancora abilitata per il Bridge.");
  const file = await readPrintSource(job.sourcePath);
  if (file.sha256 !== job.sha256 || file.fileSize !== job.fileSize) throw new Error("Il contenuto non corrisponde al PDF approvato.");
  return file.bytes;
}
export async function reportPrintJob(bridgeId: string, report: Report) {
  assertPrintEnabled();
  if (!["DELIVERED", "ERROR", "NEEDS_REVIEW"].includes(report.outcome)) throw new Error("Esito non consentito al Bridge.");
  return prisma.$transaction(async tx => {
    const job = await lockedJob(tx, bridgeId, report.jobId, report.claimToken);
    if ((job.status === "DELIVERED" || job.status === "PRINTED") && report.outcome === "DELIVERED" && job.dispatchId === report.dispatchId) return;
    if (job.status === report.outcome && (job.status === "ERROR" || job.status === "NEEDS_REVIEW")) return;
    const beforeDispatch = job.status === "PREPARING" && report.outcome === "ERROR" && !job.dispatchId;
    const afterDispatch = ["SENDING", "NEEDS_REVIEW"].includes(job.status) && report.dispatchId === job.dispatchId && !!job.dispatchId && report.outcome !== "ERROR";
    if (!beforeDispatch && !afterDispatch) throw new Error("Transizione di stato non consentita.");
    const detail = report.detail.slice(0, 500);
    await tx.printJob.update({ where: { id: job.id }, data: { status: report.outcome, leaseExpiresAt: null,
      deliveredAt: report.outcome === "DELIVERED" ? new Date() : undefined,
      lastError: report.outcome === "DELIVERED" ? "" : detail, version: { increment: 1 } } });
    await event(tx, job.id, `report:${job.claimToken}:${report.outcome}`, report.outcome, detail, bridgeId);
  });
}
export async function managePrintJob(userId: string, id: string, version: number, action: string, reason: string) {
  const actor = await assertPrintAdmin(userId);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "PrintJob" WHERE "id" = ${id} FOR UPDATE`;
    const job = await tx.printJob.findUnique({ where: { id } });
    if (!job || job.version !== version) throw new Error("Stato aggiornato da un altro dispositivo. Ricarica la pagina.");
    let status: PrintJobStatus;
    if (action === "cancel" && ["APPROVED", "PREPARING"].includes(job.status)) status = "CANCELLED";
    else if (action === "printed" && job.status === "DELIVERED") status = "PRINTED";
    else if (action === "review" && job.status === "SENDING") status = "NEEDS_REVIEW";
    else if (action === "received" && job.status === "NEEDS_REVIEW") status = "DELIVERED";
    else if (action === "not-received" && job.status === "NEEDS_REVIEW") status = "ERROR";
    else throw new Error("Operazione non consentita per questo stato.");
    if (reason.trim().length < 8) throw new Error("Descrivi la verifica effettuata (almeno 8 caratteri).");
    // A manual resolution fences old workers and late receipts. It never enqueues a retry.
    await tx.printJob.update({ where: { id }, data: { status, version: { increment: 1 }, claimToken: action === "review" ? job.claimToken : null, leaseExpiresAt: null,
      lastError: status === "ERROR" || status === "NEEDS_REVIEW" ? reason.slice(0, 500) : "",
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
      printedAt: status === "PRINTED" ? new Date() : undefined, printedById: status === "PRINTED" ? actor.id : undefined } });
    await event(tx, id, `manual:${id}:${version}`, status, reason.slice(0, 500), actor.id);
  });
}
export async function revokePrintBridge(userId: string, bridgeId: string) {
  await assertPrintAdmin(userId);
  await prisma.printBridge.update({ where: { id: bridgeId }, data: { enabled: false } });
}
