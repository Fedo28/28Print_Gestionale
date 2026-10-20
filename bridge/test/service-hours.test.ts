import test from "node:test";
import assert from "node:assert/strict";
import { isNightPause, nextOpening } from "../src/service-hours.ts";

test("orario italiano: confini estate/inverno, mezzanotte e fine settimana", () => {
  for (const [time, paused] of [
    ["2026-10-20T05:59:59Z", true], ["2026-10-20T06:00:00Z", false],
    ["2026-10-20T17:59:59Z", false], ["2026-10-20T18:00:00Z", true],
    ["2026-12-20T06:59:59Z", true], ["2026-12-20T07:00:00Z", false],
    ["2026-12-20T18:59:59Z", false], ["2026-12-20T19:00:00Z", true],
    ["2026-10-20T22:00:00Z", true]
  ] as const) assert.equal(isNightPause(new Date(time)), paused, time);
});
test("riapertura alle 8 anche nelle notti del cambio ora", () => {
  assert.equal(nextOpening(new Date("2026-10-24T18:00:00Z")).toISOString(), "2026-10-25T07:00:00.000Z");
  assert.equal(nextOpening(new Date("2026-03-28T19:00:00Z")).toISOString(), "2026-03-29T06:00:00.000Z");
  assert.equal(nextOpening(new Date("2026-10-20T05:59:59Z")).toISOString(), "2026-10-20T06:00:00.000Z");
});
