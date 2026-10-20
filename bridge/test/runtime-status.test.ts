import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RuntimeStatus } from "../src/runtime-status.ts";

test("diagnostica conserva l'ultimo ciclo riuscito senza dati sensibili", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bridge-status-"));
  try {
    const status = new RuntimeStatus(root);
    await status.publish("starting");
    assert.equal(JSON.parse(await readFile(path.join(root, "runtime-status.json"), "utf8")).lastSuccessAt, null);
    await status.publish("running");
    const success = JSON.parse(await readFile(path.join(root, "runtime-status.json"), "utf8"));
    await status.publish("retrying", 2);
    const retry = JSON.parse(await readFile(path.join(root, "runtime-status.json"), "utf8"));
    assert.equal(retry.lastSuccessAt, success.lastSuccessAt);
    assert.equal(retry.failures, 2);
    assert.deepEqual(Object.keys(retry).sort(), ["version", "instanceId", "pid", "state", "updatedAt", "lastSuccessAt", "failures"].sort());
    await status.publish("stopped", 2);
    assert.equal(JSON.parse(await readFile(path.join(root, "runtime-status.json"), "utf8")).state, "stopped");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("arresto riguarda solo l'istanza corrente, mai un riavvio successivo", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bridge-stop-"));
  try {
    const first = new RuntimeStatus(root);
    assert.equal(await first.stopRequested(), false);
    await writeFile(path.join(root, "stop-request.json"), "incompleto");
    assert.equal(await first.stopRequested(), false);
    await writeFile(path.join(root, "stop-request.json"), JSON.stringify({ instanceId: first.instanceId }));
    assert.equal(await first.stopRequested(), true);
    const restarted = new RuntimeStatus(root);
    assert.equal(await restarted.stopRequested(), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("diagnostica non scrivibile non blocca il motore di consegna", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bridge-status-error-"));
  try {
    const status = new RuntimeStatus(path.join(root, "missing"));
    await assert.doesNotReject(status.publish("running"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
