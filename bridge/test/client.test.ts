import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpPrintApi, ApiError } from "../src/client.ts";
import { PROFILE, type PrintManifest } from "../src/protocol.ts";

const token = "b".repeat(43);
const bypass = "v".repeat(32);
const job: PrintManifest = {
  id: "c922b264-8ba1-41c1-aa85-b90c7c3671c8", claimToken: "77aca6d2-71f0-4c18-a010-9cd8e4d7af42",
  destinationKey: "test", profileKey: PROFILE, fileSize: 4, sha256: "a".repeat(64)
};

test("protected Preview uses both credentials on every operation, only in headers", async t => {
  const calls: { url: string; init: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url.endsWith("/file") ? new Response("%PDF", { headers: { "content-type": "application/pdf" } }) :
      Response.json({ job: null });
  });
  const api = new HttpPrintApi("https://preview.example.invalid", token, bypass);
  await api.claim(["test"]); await api.renew(job); await api.begin(job, job.id);
  await api.download(job);
  await api.report({ jobId: job.id, claimToken: job.claimToken, dispatchId: job.id, outcome: "DELIVERED", detail: "Test sintetico" });
  assert.equal(calls.length, 5);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).origin, "https://preview.example.invalid");
    assert.equal(new URL(url).search, "");
    assert.equal(init.redirect, "error");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), `Bearer ${token}`);
    assert.equal(headers.get("x-vercel-protection-bypass"), bypass);
    assert.equal(headers.has("x-vercel-set-bypass-cookie"), false);
    assert.equal(String(init.body).includes(token), false);
    assert.equal(String(init.body).includes(bypass), false);
  }
});

test("unprotected endpoint does not receive an automation header", async t => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).has("x-vercel-protection-bypass"), false);
    return Response.json({ job: null });
  });
  assert.equal(await new HttpPrintApi("http://127.0.0.1:3015", token).claim(["test"]), null);
});

test("automation secret is rejected on HTTP, in URL, or with unsafe characters", () => {
  assert.throws(() => new HttpPrintApi("http://127.0.0.1:3015", token, bypass), /HTTPS/);
  assert.throws(() => new HttpPrintApi("https://test.invalid/?secret=value", token, bypass), /Origine/);
  assert.throws(() => new HttpPrintApi("https://user:pass@test.invalid", token, bypass), /Origine/);
  assert.throws(() => new HttpPrintApi("https://test.invalid", token, bypass + "\r\n"), /non valida/);
  assert.throws(() => new HttpPrintApi("https://test.invalid", token, ""), /non valida/);
});

test("rejected automation never exposes response or secrets in errors", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(`private ${token} ${bypass}`, { status: 401 }));
  await assert.rejects(new HttpPrintApi("https://test.invalid", token, bypass).claim(["test"]), error => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message.includes(token), false);
    assert.equal(error.message.includes(bypass), false);
    return true;
  });
});

test("redirect responses are not followed by the client", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls++; assert.equal(init.redirect, "error");
    return new Response(null, { status: 307, headers: { location: "https://another.invalid" } });
  });
  await assert.rejects(new HttpPrintApi("https://test.invalid", token, bypass).claim(["test"]), ApiError);
  assert.equal(calls, 1);
});
