import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { PROFILE } from "../src/protocol.ts";

async function until<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { const value = await read(); if (accept(value)) return value; } catch {}
    await sleep(40);
  }
  throw Error("Timeout lifecycle Bridge");
}
for (const responseCode of [200, 503, 0]) test(`CLI: pausa cooperativa e riavvio con API simulata ${responseCode} (0=notte senza HTTP)`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bridge-cli-"));
  const children: ChildProcess[] = [];
  try {
    const hot = path.join(root, "hot"); await mkdir(hot);
    const workDir = path.join(root, "work");
    const config = path.join(root, "config.json");
    await writeFile(config, JSON.stringify({ baseUrl: "https://unit.invalid", workDir, pollSeconds: 5,
      destinations: { test: { hotFolder: hot, staging: path.join(root, "stage"), profileKey: PROFILE, verifiedHoldOneCopy: true } } }));
    const mock = path.join(root, "mock.mjs");
    await writeFile(mock, `
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-20T${responseCode === 0 ? "21" : "10"}:00:00Z'])); }
    };
    globalThis.fetch = async (url) => {
      ${responseCode === 0 ? "process.exit(99);" : ""}
      if (url !== 'https://unit.invalid/api/print-bridge') throw Error('Unexpected endpoint');
      return new Response(JSON.stringify({job:null}), {status:${responseCode}, headers:{'content-type':'application/json'}});
    };`);
    const statusPath = path.join(workDir, "data/runtime-status.json");
    const read = async () => JSON.parse(await readFile(statusPath, "utf8"));
    const start = () => {
      const env: NodeJS.ProcessEnv = { ...process.env, PRINT_BRIDGE_TOKEN: "a".repeat(43) };
      delete env.PRINT_BRIDGE_VERCEL_BYPASS;
      const child = spawn(process.execPath, ["--import", pathToFileURL(mock).href,
        fileURLToPath(new URL("../src/cli.ts", import.meta.url)), "run", config], { env, stdio: "ignore" });
      children.push(child); return child;
    };
    const state = responseCode === 0 ? "night_paused" : responseCode === 200 ? "running" : "retrying";
    const first = start();
    const before = await until(read, s => s.state === state);
    await writeFile(path.join(workDir, "data/stop-request.json"), JSON.stringify({ instanceId: before.instanceId }));
    await until(async () => first.exitCode, code => code !== null);
    assert.equal(first.exitCode, 0);
    assert.equal((await read()).state, "stopped");
    const second = start();
    const after = await until(read, s => s.instanceId !== before.instanceId && s.state === state);
    assert.equal(second.exitCode, null, "La vecchia richiesta di pausa non ferma il nuovo processo");
    await writeFile(path.join(workDir, "data/stop-request.json"), JSON.stringify({ instanceId: after.instanceId }));
    await until(async () => second.exitCode, code => code !== null);
    assert.equal(second.exitCode, 0);
    assert.deepEqual(await readdir(hot), []);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(); await new Promise(resolve => child.once("exit", resolve));
      }
    }
    await rm(root, { recursive: true, force: true });
  }
});
