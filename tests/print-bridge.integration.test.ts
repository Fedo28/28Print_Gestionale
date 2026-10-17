import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { prisma } from "../lib/prisma";
import { approvePrint, authenticateBridge, beginPrintDispatch, claimPrintJob, getPrintDownload, managePrintJob, reportPrintJob, tokenHash } from "../lib/print-jobs";
import { printEnabled } from "../lib/print-runtime";
import { readPrintSource } from "../lib/print-source";
import { PROFILE, type PrintManifest } from "../bridge/src/protocol";
import { inspectPdf } from "../bridge/src/pdf";
import { Ledger } from "../bridge/src/ledger";
import { Worker } from "../bridge/src/worker";
import { HttpPrintApi } from "../bridge/src/client";
import { checkDirectories, type BridgeConfig } from "../bridge/src/config";
import { POST } from "../app/api/print-bridge/route";
import { GET } from "../app/api/print-bridge/jobs/[id]/file/route";
import { savePrintConfiguration } from "../lib/print-settings";
import { GET as verifyWhatsApp, POST as receiveWhatsApp } from "../app/api/webhooks/whatsapp/route";

const url = process.env.PRINT_BRIDGE_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "54339" || parsed.pathname !== "/fede_print_bridge_test" || process.env.DATABASE_URL !== url || process.env.BLOB_READ_WRITE_TOKEN) throw Error("Test Bridge riservati al database e storage locali isolati.");
}
describe.runIf(Boolean(url))("Print Bridge: isolated PostgreSQL + HTTP + SQLite + simulated Hot Folder", () => {
  const admin = randomUUID(), operator = randomUUID(), customer = randomUUID();
  const orders: string[] = [], bridges: string[] = [], printers: string[] = [], profiles: string[] = [];
  const sourceDir = `bridge-it-${randomUUID()}`;
  let pdf: Buffer, sha256: string;
  beforeAll(async () => {
    pdf = await readFile(path.join(process.cwd(), "output/pdf/28print-fiery-test-a4.pdf"));
    sha256 = (await inspectPdf(pdf)).sha256;
    await mkdir(path.join(process.cwd(), "public/uploads/orders", sourceDir), { recursive: true });
    for (const [id, role] of [[admin, "ADMIN"], [operator, "OPERATOR"]] as const) await prisma.user.create({ data: { id, nickname: id, email: `${id}@example.invalid`, name: "Bridge test", passwordHash: "test-no-login", role } });
    await prisma.customer.create({ data: { id: customer, name: "Synthetic bridge test" } });
  });
  afterAll(async () => {
    await prisma.printJobEvent.deleteMany({ where: { job: { orderId: { in: orders } } } });
    await prisma.printJob.deleteMany({ where: { orderId: { in: orders } } });
    await prisma.printDestination.deleteMany({ where: { bridgeId: { in: bridges } } });
    await prisma.printBridge.deleteMany({ where: { id: { in: bridges } } });
    await prisma.printPrinter.deleteMany({ where: { id: { in: printers } } });
    await prisma.printProfile.deleteMany({ where: { id: { in: profiles } } });
    await prisma.order.deleteMany({ where: { id: { in: orders } } });
    await prisma.customer.deleteMany({ where: { id: customer } });
    await prisma.user.deleteMany({ where: { id: { in: [admin, operator] } } });
    await rm(path.join(process.cwd(), "public/uploads/orders", sourceDir), { recursive: true, force: true });
    await prisma.$disconnect();
  });
  async function fixture() {
    const id = randomUUID(), token = randomBytes(32).toString("base64url"), key = `test-${id}`;
    const order = await prisma.order.create({ data: { customerId: customer, orderCode: id, title: "Synthetic PDF order", titleNormalized: id, createdOn: "2026-10-15", deliveryAt: new Date() } }); orders.push(order.id);
    const filePath = `/uploads/orders/${sourceDir}/${id}.pdf`;
    await writeFile(path.join(process.cwd(), "public", filePath), pdf);
    const attachment = await prisma.attachment.create({ data: { orderId: order.id, fileName: "test.pdf", filePath, mimeType: "application/pdf", sizeBytes: pdf.length } });
    const bridge = await prisma.printBridge.create({ data: { name: "Simulated bridge", tokenHash: tokenHash(token), destinations: { create: { key, name: "Fake hot folder", printerName: "Simulated IPC650", profileKey: PROFILE,
      printer: { create: { name: "Simulated IPC650" } }, profile: { connect: { key: PROFILE } }
    } } }, include: { destinations: true } }); bridges.push(bridge.id); printers.push(bridge.destinations[0].printerId!);
    const input = { userId: admin, orderId: order.id, attachmentId: attachment.id, destinationId: bridge.destinations[0].id, sha256 };
    return { order, attachment, bridge, key, token, input, approve: () => approvePrint(input), claim: () => claimPrintJob(bridge.id, [key]) };
  }
  it("WhatsApp webhook persists once, rejects wrong signatures and never creates print jobs", async () => {
    const id = `wamid.${randomUUID()}`;
    const settings = { WHATSAPP_WEBHOOK_ENABLED: "true", WHATSAPP_APP_SECRET: "synthetic-app-secret-32-characters", WHATSAPP_VERIFY_TOKEN: "synthetic-verify-token-32-characters", WHATSAPP_TEST_ACCOUNT_ID: "123", WHATSAPP_TEST_PHONE_NUMBER_ID: "456" };
    for (const [key, value] of Object.entries(settings)) vi.stubEnv(key, value);
    const before = await prisma.printJob.count();
    try {
      const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "123", changes: [{ field: "messages", value: { metadata: { phone_number_id: "456" }, messages: [{ id, from: "39000000000", timestamp: "1792159200", type: "document", document: { id: "789", filename: "synthetic.pdf", mime_type: "application/pdf" } }] } }] }] });
      const request = (signature: string) => new Request("https://preview.invalid/api/webhooks/whatsapp", { method: "POST", body, headers: { "x-hub-signature-256": signature } });
      expect((await receiveWhatsApp(request("sha256=invalid"))).status).toBe(401);
      const signature = `sha256=${createHmac("sha256", settings.WHATSAPP_APP_SECRET).update(body).digest("hex")}`;
      const responses = await Promise.all([receiveWhatsApp(request(signature)), receiveWhatsApp(request(signature))]);
      expect(responses.map(r => r.status)).toEqual([200, 200]);
      expect(await prisma.whatsAppInboundMessage.count({ where: { providerMessageId: id } })).toBe(1);
      expect(await prisma.printJob.count()).toBe(before);
      expect((await verifyWhatsApp(new Request(`https://preview.invalid/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${settings.WHATSAPP_VERIFY_TOKEN}&hub.challenge=1234`))).status).toBe(200);
      vi.stubEnv("WHATSAPP_WEBHOOK_ENABLED", "false"); expect((await receiveWhatsApp(request(signature))).status).toBe(404);
    } finally { await prisma.whatsAppInboundMessage.deleteMany({ where: { providerMessageId: id } }); vi.unstubAllEnvs(); }
  });
  it("requires approval and an active administrator", async () => {
    const f = await fixture(); expect(await f.claim()).toBeNull();
    await expect(approvePrint({ ...f.input, userId: operator })).rejects.toThrow(/amministratore/);
    await prisma.user.update({ where: { id: admin }, data: { active: false } });
    try { await expect(f.approve()).rejects.toThrow(/amministratore/); } finally { await prisma.user.update({ where: { id: admin }, data: { active: true } }); }
    expect(await prisma.printJob.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  const form = (values: Record<string, string>) => { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; };
  it("configuration is admin-only and new destinations need explicit verification", async () => {
    const f = await fixture();
    await expect(savePrintConfiguration(operator, form({ operation: "printer", name: "Forbidden", preferredFor: "BW" }))).rejects.toThrow(/amministratore/);
    const destinationKey = `new-${randomUUID()}`;
    await savePrintConfiguration(admin, form({ operation: "destination", name: "New simulated folder", key: destinationKey,
      bridgeId: f.bridge.id, printerId: f.bridge.destinations[0].printerId!, profileId: f.bridge.destinations[0].profileId! }));
    const d = await prisma.printDestination.findUniqueOrThrow({ where: { key: destinationKey } });
    expect(d.enabled).toBe(false);
    const toggle = { operation: "toggle", kind: "destination", id: d.id, enabled: "true" };
    await expect(savePrintConfiguration(admin, form(toggle))).rejects.toThrow(/Conferma/);
    await savePrintConfiguration(admin, form({ ...toggle, verified: "on" }));
    expect((await prisma.printDestination.findUniqueOrThrow({ where: { id: d.id } })).enabled).toBe(true);
    expect(await prisma.printJob.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  it("unsupported profiles may be prepared but cannot be activated or approved", async () => {
    const f = await fixture(), key = `A3_COLOR_${randomUUID().replaceAll("-", "").toUpperCase()}`;
    await savePrintConfiguration(admin, form({ operation: "profile", key, name: "Future A3", paperSize: "A3", colorMode: "COLOR", sides: "SIMPLEX", copies: "2" }));
    const profile = await prisma.printProfile.findUniqueOrThrow({ where: { key } }); profiles.push(profile.id);
    await savePrintConfiguration(admin, form({ operation: "destination", name: "Future folder", key: `future-${f.bridge.id}`,
      bridgeId: f.bridge.id, printerId: f.bridge.destinations[0].printerId!, profileId: profile.id }));
    const d = await prisma.printDestination.findUniqueOrThrow({ where: { key: `future-${f.bridge.id}` } });
    await expect(savePrintConfiguration(admin, form({ operation: "toggle", kind: "destination", id: d.id, enabled: "true", verified: "on" }))).rejects.toThrow(/supporto/);
    await expect(approvePrint({ ...f.input, destinationId: d.id })).rejects.toThrow(/non disponibili/);
  });
  it("printer disable fences approval, queued claims and prepared dispatch without erasing history", async () => {
    const f = await fixture();
    const toggle = async (enabled: string) => {
      await savePrintConfiguration(admin, form({ operation: "toggle", kind: "printer", id: f.bridge.destinations[0].printerId!, enabled }));
      expect((await prisma.printDestination.findUniqueOrThrow({ where: { id: f.input.destinationId } })).enabled).toBe(false);
      if (enabled === "true") await savePrintConfiguration(admin, form({ operation: "toggle", kind: "destination", id: f.input.destinationId, enabled, verified: "on" }));
    };
    await toggle("false"); await expect(f.approve()).rejects.toThrow(/non disponibili/);
    await toggle("true"); const id = await f.approve();
    await toggle("false"); expect(await f.claim()).toBeNull();
    await toggle("true"); const claim = (await f.claim())!;
    await toggle("false");
    await expect(beginPrintDispatch(f.bridge.id, id, claim.claimToken, randomUUID())).rejects.toThrow(/non autorizzato/);
    expect(await prisma.printJobEvent.count({ where: { jobId: id, type: "APPROVED" } })).toBe(1);
  });
  it("profile disable blocks a prepared worker but does not reject an already authorized delivery receipt", async () => {
    const f = await fixture(), id = await f.approve(), claim = (await f.claim())!;
    const profileId = f.bridge.destinations[0].profileId!;
    const enabledBefore = await prisma.printDestination.findMany({ where: { profileId, enabled: true }, select: { id: true } });
    const toggle = async (enabled: string) => {
      await savePrintConfiguration(admin, form({ operation: "toggle", kind: "profile", id: profileId, enabled }));
      if (enabled === "true") await savePrintConfiguration(admin, form({ operation: "toggle", kind: "destination", id: f.input.destinationId, enabled, verified: "on" }));
    };
    try {
      await toggle("false");
      await expect(getPrintDownload(f.bridge.id, id, claim.claimToken)).rejects.toThrow(/non autorizzato/);
      await expect(beginPrintDispatch(f.bridge.id, id, claim.claimToken, randomUUID())).rejects.toThrow(/non autorizzato/);
      await toggle("true"); const dispatchId = randomUUID();
      await beginPrintDispatch(f.bridge.id, id, claim.claimToken, dispatchId);
      await toggle("false");
      await reportPrintJob(f.bridge.id, { jobId: id, claimToken: claim.claimToken, dispatchId, outcome: "DELIVERED", detail: "Already authorized receipt" });
      expect((await prisma.printJob.findUniqueOrThrow({ where: { id } })).status).toBe("DELIVERED");
    } finally {
      await toggle("true");
      for (const d of enabledBefore) await savePrintConfiguration(admin, form({ operation: "toggle", kind: "destination", id: d.id, enabled: "true", verified: "on" }));
    }
  });
  it("unlinked or remapped destinations cannot claim an approved legacy job", async () => {
    const f = await fixture(); await f.approve();
    await prisma.printDestination.update({ where: { id: f.input.destinationId }, data: { profileId: null } });
    expect(await f.claim()).toBeNull();
  });
  it("deduplicates concurrent approvals and exclusive concurrent claims", async () => {
    const f = await fixture();
    const ids = await Promise.all([f.approve(), f.approve(), f.approve()]); expect(new Set(ids).size).toBe(1);
    const approved = await prisma.printJob.findUniqueOrThrow({ where: { id: ids[0] } });
    expect([approved.sourceType, approved.sourceId, approved.requestKey]).toEqual(["ORDER_ATTACHMENT", f.attachment.id, `original:${f.attachment.id}:${sha256}`]);
    const claims = await Promise.all([f.claim(), f.claim(), f.claim()]); expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await prisma.printJobEvent.count({ where: { jobId: ids[0], type: "APPROVED" } })).toBe(1);
  });
  it("does not serve a future source through the order-attachment download path", async () => {
    const f = await fixture(); const id = await f.approve();
    await prisma.printJob.update({ where: { id }, data: { sourceType: "WHATSAPP_MEDIA" } });
    const claim = (await f.claim())!;
    await expect(getPrintDownload(f.bridge.id, id, claim.claimToken)).rejects.toThrow(/non ancora abilitata/);
  });
  it("fences expired workers and never automatically reclaims sending jobs", async () => {
    const f = await fixture(); await f.approve(); const old = (await f.claim())!;
    await prisma.printJob.update({ where: { id: old.id }, data: { leaseExpiresAt: new Date(0) } });
    const current = (await f.claim())!; expect(current.claimToken).not.toBe(old.claimToken);
    await expect(beginPrintDispatch(f.bridge.id, old.id, old.claimToken, randomUUID())).rejects.toThrow(/Assegnazione/);
    const dispatch = randomUUID(); await beginPrintDispatch(f.bridge.id, current.id, current.claimToken, dispatch);
    await beginPrintDispatch(f.bridge.id, current.id, current.claimToken, dispatch);
    expect(await f.claim()).toBeNull();
    await prisma.printJob.update({ where: { id: current.id }, data: { sendingAt: new Date(0) } });
    expect(await f.claim()).toBeNull(); expect((await prisma.printJob.findUniqueOrThrow({ where: { id: current.id } })).status).toBe("NEEDS_REVIEW");
    await reportPrintJob(f.bridge.id, { jobId: current.id, claimToken: current.claimToken, dispatchId: dispatch, outcome: "DELIVERED", detail: "Late durable receipt" });
    expect((await prisma.printJob.findUniqueOrThrow({ where: { id: current.id } })).status).toBe("DELIVERED");
  });
  it("rejects changed source bytes both at approval and download", async () => {
    const f = await fixture(); await expect(approvePrint({ ...f.input, sha256: "0".repeat(64) })).rejects.toThrow(/cambiato/);
    await f.approve(); const job = (await f.claim())!;
    await writeFile(path.join(process.cwd(), "public", f.attachment.filePath), Buffer.concat([pdf, Buffer.from("\n% changed") ]));
    await expect(getPrintDownload(f.bridge.id, job.id, job.claimToken)).rejects.toThrow(/approvato/);
  });
  it("restricts credentials, destination and download scope, including revocation", async () => {
    const a = await fixture(), b = await fixture(); await a.approve();
    expect(await claimPrintJob(b.bridge.id, [a.key])).toBeNull();
    const job = (await a.claim())!;
    await expect(getPrintDownload(b.bridge.id, job.id, job.claimToken)).rejects.toThrow(/autorizzato/);
    await expect(authenticateBridge(`Bearer ${randomBytes(32).toString("base64url")}`)).rejects.toThrow(/autorizzato/);
    expect(await authenticateBridge(`Bearer ${a.token}`)).toBe(a.bridge.id);
    await prisma.printBridge.update({ where: { id: a.bridge.id }, data: { enabled: false } });
    await expect(authenticateBridge(`Bearer ${a.token}`)).rejects.toThrow(/autorizzato/);
    await expect(beginPrintDispatch(a.bridge.id, job.id, job.claimToken, randomUUID())).rejects.toThrow(/autorizzato/);
  });
  it("cancellation fences a prepared worker", async () => {
    const f = await fixture(); const id = await f.approve(); const job = (await f.claim())!;
    const current = await prisma.printJob.findUniqueOrThrow({ where: { id } });
    await managePrintJob(admin, id, current.version, "cancel", "Annullamento di prova");
    await expect(beginPrintDispatch(f.bridge.id, id, job.claimToken, randomUUID())).rejects.toThrow(/Assegnazione/);
    expect(await f.claim()).toBeNull();
  });
  it("delivery receipts are idempotent; physical printing requires manual confirmation", async () => {
    const f = await fixture(); const id = await f.approve(); const job = (await f.claim())!, dispatchId = randomUUID();
    await beginPrintDispatch(f.bridge.id, id, job.claimToken, dispatchId);
    const report = { jobId: id, claimToken: job.claimToken, dispatchId, outcome: "DELIVERED" as const, detail: "File published" };
    await Promise.all([reportPrintJob(f.bridge.id, report), reportPrintJob(f.bridge.id, report)]);
    const delivered = await prisma.printJob.findUniqueOrThrow({ where: { id } }); expect(delivered.status).toBe("DELIVERED"); expect(delivered.printedAt).toBeNull();
    await expect(reportPrintJob(f.bridge.id, { ...report, outcome: "PRINTED" as never })).rejects.toThrow(/non consentito/);
    await managePrintJob(admin, id, delivered.version, "printed", "Stampa fisica verificata manualmente");
    const printed = await prisma.printJob.findUniqueOrThrow({ where: { id } }); expect(printed.printedById).toBe(admin);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).mainPhase).toBe("ACCETTATO");
  });
  it("uncertain outcomes require manual resolution and a new explicit approval", async () => {
    const f = await fixture(); const id = await f.approve(); const job = (await f.claim())!, dispatchId = randomUUID();
    await beginPrintDispatch(f.bridge.id, id, job.claimToken, dispatchId);
    await reportPrintJob(f.bridge.id, { jobId: id, claimToken: job.claimToken, dispatchId, outcome: "NEEDS_REVIEW", detail: "Unknown filesystem outcome" });
    await expect(approvePrint({ ...f.input, reprintOfId: id, reason: "Nuova prova" })).rejects.toThrow(/non consentito/);
    const uncertain = await prisma.printJob.findUniqueOrThrow({ where: { id } });
    await managePrintJob(admin, id, uncertain.version, "not-received", "Bridge arrestato; verificati registro e coda Fiery");
    expect(await f.claim()).toBeNull();
    const children = await Promise.all([approvePrint({ ...f.input, reprintOfId: id, reason: "Nuovo invio autorizzato" }), approvePrint({ ...f.input, reprintOfId: id, reason: "Nuovo invio autorizzato" })]);
    expect(children[0]).toBe(children[1]); expect(children[0]).not.toBe(id);
    await expect(reportPrintJob(f.bridge.id, { jobId: id, claimToken: job.claimToken, dispatchId, outcome: "DELIVERED", detail: "obsolete" })).rejects.toThrow(/Assegnazione/);
  });
  it("rejects untrusted source hosts and cannot be enabled on Vercel production", async () => {
    await expect(readPrintSource("http://127.0.0.1:8080/private")).rejects.toThrow(/autorizzato/);
    await expect(readPrintSource("https://example.com/orders/test.pdf")).rejects.toThrow(/autorizzato/);
    vi.stubEnv("VERCEL_ENV", "production"); try { expect(printEnabled()).toBe(false); } finally { vi.unstubAllEnvs(); }
  });
  it("runs the full authenticated HTTP -> PostgreSQL -> Bridge -> fake Hot Folder flow", async () => {
    const f = await fixture();
    const server = createServer(async (req, res) => {
      try {
        const parts: Buffer[] = []; for await (const part of req) parts.push(Buffer.from(part));
        const url = `http://127.0.0.1${req.url}`;
        const request = new Request(url, { method: req.method, headers: req.headers as Record<string, string>, ...(req.method === "POST" ? { body: Buffer.concat(parts) } : {}) });
        const match = new URL(url).pathname.match(/^\/api\/print-bridge\/jobs\/([^/]+)\/file$/);
        const response = req.method === "POST" ? await POST(request) : match ? await GET(request, { params: { id: match[1] } }) : new Response(null, { status: 404 });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) { const reader = response.body.getReader(); while (true) { const chunk = await reader.read(); if (chunk.done) break; res.write(chunk.value); } }
        res.end();
      } catch { res.writeHead(500); res.end(); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const root = await mkdtemp(path.join(os.tmpdir(), "28print-e2e-")), hot = path.join(root, "simulated-hot-folder"); await mkdir(hot);
    const config: BridgeConfig = { baseUrl: `http://127.0.0.1:${address.port}`, allowLoopbackHttp: true, workDir: path.join(root, "bridge"), pollSeconds: 5,
      destinations: { [f.key]: { hotFolder: hot, staging: path.join(root, "staging"), profileKey: PROFILE, verifiedHoldOneCopy: true } } };
    await checkDirectories(config); const ledger = new Ledger(path.join(config.workDir, "data"));
    try {
      const api = new HttpPrintApi(config.baseUrl, f.token);
      const worker = new Worker(config, api, ledger, async () => {});
      await worker.tick(); expect(await readdir(hot)).toEqual([]);
      const id = await f.approve(); await worker.tick(); expect(await readdir(hot)).toEqual([`28PRINT-${id}.pdf`]);
      expect((await prisma.printJob.findUniqueOrThrow({ where: { id } })).status).toBe("SENDING");
      await worker.tick(); await worker.tick(); expect((await prisma.printJob.findUniqueOrThrow({ where: { id } })).status).toBe("DELIVERED");
      expect(await readFile(path.join(hot, `28PRINT-${id}.pdf`))).toEqual(pdf);
      const response = await fetch(`${config.baseUrl}/api/print-bridge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "claim", destinations: [f.key] }) }); expect(response.status).toBe(401);
    } finally { ledger.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); }
  });
});
