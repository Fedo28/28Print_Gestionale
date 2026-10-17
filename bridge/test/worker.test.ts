import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PDFDocument, PageSizes } from "pdf-lib";
import { PROFILE, type PrintManifest, type Report } from "../src/protocol.ts";
import { checkDirectories, loadConfig, type BridgeConfig } from "../src/config.ts";
import { Ledger } from "../src/ledger.ts";
import { Worker } from "../src/worker.ts";
import { ApiError, type PrintApi } from "../src/client.ts";
import { inspectPdf } from "../src/pdf.ts";

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "28print-unit-"));
  const hot = path.join(root, "fake-hot-folder"); await mkdir(hot);
  const config: BridgeConfig = { baseUrl: "https://test.example.invalid", workDir: path.join(root, "bridge"), pollSeconds: 5,
    destinations: { test: { hotFolder: hot, staging: path.join(root, "staging"), profileKey: PROFILE, verifiedHoldOneCopy: true } } };
  await checkDirectories(config);
  const pdf = await PDFDocument.create(); pdf.addPage(PageSizes.A4);
  const bytes = await pdf.save();
  const job: PrintManifest = { id: randomUUID(), claimToken: randomUUID(), destinationKey: "test", profileKey: PROFILE, fileSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  let supplied = false, begins = 0; const reports: Report[] = [];
  const api: PrintApi = { claim: async () => { if (supplied) return null; supplied = true; return job; }, renew: async () => {}, download: async () => bytes,
    begin: async () => { begins++; }, report: async r => { reports.push(r); } };
  const ledger = new Ledger(path.join(config.workDir, "data"));
  const worker = new Worker(config, api, ledger, async () => {});
  return { root, config, hot, job, bytes, api, ledger, worker, reports, begins: () => begins, cleanup: async () => { ledger.close(); await rm(root, { recursive: true, force: true }); } };
}
test("publishes once, records receipt, reports without marking physical printing", async () => {
  const s = await setup();
  try {
    await s.worker.tick(); assert.equal(s.begins(), 1); assert.equal((await readdir(s.hot)).length, 1);
    assert.deepEqual(new Uint8Array(await readFile(path.join(s.hot, `28PRINT-${s.job.id}.pdf`))), s.bytes);
    await s.worker.tick(); await s.worker.tick();
    assert.equal(s.reports.length, 1); assert.equal(s.reports[0].outcome, "DELIVERED"); assert.equal(s.begins(), 1);
  } finally { await s.cleanup(); }
});
test("lost acknowledgement retries only the receipt even after Fiery consumes the file", async () => {
  const s = await setup();
  try {
    await s.worker.tick(); await rm(path.join(s.hot, `28PRINT-${s.job.id}.pdf`));
    const report = s.api.report; let fails = true;
    s.api.report = async r => { if (fails) { fails = false; throw Error("offline"); } await report(r); };
    await assert.rejects(s.worker.tick()); await s.worker.tick();
    assert.equal((await readdir(s.hot)).length, 0); assert.equal(s.begins(), 1); assert.equal(s.reports.length, 1);
  } finally { await s.cleanup(); }
});
test("crash after filesystem publication is quarantined on restart", async () => {
  const s = await setup();
  try {
    // Separate process actually exits without cleanup/receipt; OS releases SQLite instance lock.
    s.ledger.close();
    const source = `import { Ledger } from './src/ledger.ts'; import { Worker } from './src/worker.ts';
      const config=JSON.parse(process.env.TEST_CONFIG), job=JSON.parse(process.env.TEST_JOB), bytes=Buffer.from(process.env.TEST_PDF,'base64');
      const ledger=new Ledger(config.workDir+'/data');
      const worker=new Worker(config,{claim:async()=>job,renew:async()=>{},download:async()=>bytes,begin:async()=>{},report:async()=>{}},ledger,async()=>{});
      worker.afterPublication=()=>process.exit(77); await worker.tick();`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, TEST_CONFIG: JSON.stringify(s.config), TEST_JOB: JSON.stringify(s.job), TEST_PDF: Buffer.from(s.bytes).toString("base64") } });
    assert.equal(result.status, 77, result.stderr.toString());
    const reopened = new Ledger(path.join(s.config.workDir, "data"));
    try {
      assert.equal(reopened.get(s.job.id)?.phase, "DISPATCH_INTENT");
      s.api.claim = async () => null;
      await new Worker(s.config, s.api, reopened, async () => {}).tick();
      assert.equal(s.reports[0].outcome, "NEEDS_REVIEW"); assert.equal((await readdir(s.hot)).length, 1);
    } finally { reopened.close(); }
  } finally { await rm(s.root, { recursive: true, force: true }); }
});
test("an uncertain begin request never publishes and never retries publication", async () => {
  const s = await setup();
  try {
    s.api.begin = async () => { throw Error("connection lost after server commit"); };
    await s.worker.tick(); await s.worker.tick();
    assert.equal((await readdir(s.hot)).length, 0); assert.equal(s.reports[0].outcome, "NEEDS_REVIEW");
  } finally { await s.cleanup(); }
});
test("hash mismatch cannot reach begin or filesystem publication", async () => {
  const s = await setup();
  try {
    s.job.sha256 = "0".repeat(64); await s.worker.tick(); await s.worker.tick();
    assert.equal(s.begins(), 0); assert.equal((await readdir(s.hot)).length, 0); assert.equal(s.reports[0].outcome, "ERROR");
  } finally { await s.cleanup(); }
});
test("existing destination is never overwritten", async () => {
  const s = await setup();
  try {
    const target = path.join(s.hot, `28PRINT-${s.job.id}.pdf`); await writeFile(target, "existing");
    await s.worker.tick(); await s.worker.tick();
    assert.equal(await readFile(target, "utf8"), "existing"); assert.equal(s.reports[0].outcome, "NEEDS_REVIEW");
  } finally { await s.cleanup(); }
});
test("SQLite rejects concurrent Bridge processes using the same work directory", async () => {
  const s = await setup();
  try { assert.throws(() => new Ledger(path.join(s.config.workDir, "data")), /istanza/); }
  finally { await s.cleanup(); }
});
test("known job with a renewed server lease is rejected without a second delivery", async () => {
  const s = await setup();
  try {
    await s.worker.tick(); await s.worker.tick();
    s.api.claim = async () => ({ ...s.job, claimToken: randomUUID() });
    await s.worker.tick(); assert.equal(s.begins(), 1); assert.equal(s.reports.at(-1)?.outcome, "ERROR");
  } finally { await s.cleanup(); }
});
test("logging failure cannot erase a durable delivery receipt", async () => {
  const s = await setup();
  try {
    const worker = new Worker(s.config, s.api, s.ledger, async () => { throw Error("log failure"); });
    await assert.rejects(worker.tick()); assert.equal(s.ledger.get(s.job.id)?.phase, "DELIVERED");
    await s.worker.tick(); assert.equal(s.reports[0].outcome, "DELIVERED"); assert.equal(s.begins(), 1);
  } finally { await s.cleanup(); }
});
test("HTTP URLs are rejected except explicitly enabled loopback tests", async () => {
  const s = await setup();
  try {
    const configPath = path.join(s.root, "config.json");
    await writeFile(configPath, JSON.stringify({ ...s.config, baseUrl: "http://192.168.1.1", allowLoopbackHttp: true }));
    await assert.rejects(loadConfig(configPath), /HTTPS/);
    await writeFile(configPath, JSON.stringify({ ...s.config, baseUrl: "http://127.0.0.1:3015", allowLoopbackHttp: true }));
    assert.equal((await loadConfig(configPath)).baseUrl, "http://127.0.0.1:3015");
  } finally { await s.cleanup(); }
});
test("staging inside a monitored folder is rejected", async () => {
  const s = await setup();
  try { s.config.destinations.test.staging = path.join(s.hot, "partial"); await assert.rejects(checkDirectories(s.config), /separate/); assert.equal((await readdir(s.hot)).length, 0); }
  finally { await s.cleanup(); }
});
test("non-PDF and non-A4 pages are rejected", async () => {
  await assert.rejects(inspectPdf(Buffer.from("not a pdf")), /PDF/);
  const pdf = await PDFDocument.create(); pdf.addPage(PageSizes.A3);
  await assert.rejects(inspectPdf(await pdf.save()), /A4/);
});
