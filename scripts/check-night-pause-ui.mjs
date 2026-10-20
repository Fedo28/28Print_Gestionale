// UI-only localhost check; never submits a form or creates a print job.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE);
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-10-20T18:00:00Z") });
  await page.goto("http://127.0.0.1:3020/sospensione", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Ci ritroviamo alle 08:00." }).waitFor();
  await mkdir("output/night-pause", { recursive: true });
  await page.screenshot({ path: "output/night-pause/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/night-pause/mobile.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.clock.setSystemTime(new Date("2026-10-21T06:00:00Z"));
  await page.clock.runFor(30_001);
  await page.getByRole("heading", { name: "Il gestionale è disponibile." }).waitFor();

  // Server remains on real daytime clock, browser simulates the closing boundary.
  await page.clock.setSystemTime(new Date("2026-10-20T17:59:00Z"));
  await page.goto("http://127.0.0.1:3020/login", { waitUntil: "networkidle" });
  await page.getByRole("status").filter({ hasText: "Salva ora" }).waitFor();
  await page.clock.setSystemTime(new Date("2026-10-20T18:00:00Z"));
  await page.clock.runFor(1001);
  await page.getByRole("heading", { name: "Ci ritroviamo alle 08:00." }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.nightPause), "true");
  await page.clock.setSystemTime(new Date("2026-10-21T06:00:00Z"));
  await page.clock.runFor(1001);
  await page.getByRole("heading", { name: "Accesso", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.nightPause), "false");
  assert.deepEqual(errors, []);
  console.log("Desktop/mobile, no horizontal overflow, warning, night overlay, morning resume: passed.");
} finally {
  await browser.close();
}
