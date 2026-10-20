import test from "node:test";
import assert from "node:assert/strict";
import { nextPollSeconds } from "../src/polling.ts";

test("empty queue backs off to 60 seconds; work restores configured frequency", () => {
  assert.deepEqual([0, 1, 2, 3, 5].map(n => nextPollSeconds(15, n, 0)), [15, 30, 60, 60, 60]);
  assert.equal(nextPollSeconds(5, 5, 0), 60);
  assert.equal(nextPollSeconds(120, 5, 0), 120);
});
test("network backoff is preserved independently of empty queue", () => {
  assert.equal(nextPollSeconds(15, 0, 1), 30);
  assert.equal(nextPollSeconds(15, 5, 5), 300);
  assert.equal(nextPollSeconds(15, 0, 0), 15);
});
