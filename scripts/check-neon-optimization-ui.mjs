// Synthetic local fixture only. Never connect this script to a cloud database.
import { createRequire } from "node:module";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { verifyPrintTestIsolation } from "./print-test-env.mjs";
const require = createRequire(import.meta.url);
if (!process.env.PLAYWRIGHT_PACKAGE) throw Error("Specify installed PLAYWRIGHT_PACKAGE.");
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE);
const { PrismaClient } = require("@prisma/client");
const env = await verifyPrintTestIsolation(); env.NODE_ENV = "production";
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const marker = `Pagination-${randomUUID()}`, customerId = randomUUID();
let browser, child;
try {
  await db.customer.create({ data: { id: customerId, name: marker } });
  await db.order.createMany({ data: Array.from({ length: 61 }, (_, n) => ({
    id: randomUUID(), orderCode: `${marker}-${n}`, customerId, title: `Foto di prova ${n}`,
    titleNormalized: `${marker}-${n}`, createdOn: "2026-10-19", deliveryAt: new Date("2026-12-20")
  })) });
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3019"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let ready = false; child.stdout.on("data", b => { if (String(b).includes("Ready in")) ready = true; }); child.stderr.on("data", () => {});
  const deadline = Date.now() + 30000;
  while (!ready && child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (!ready) throw Error("Local test server unavailable");
  const executablePath = [chromium.executablePath(), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const encoded = Buffer.from(JSON.stringify({ userId: "print-test-admin", role: "ADMIN", exp: Date.now() + 300000 })).toString("base64url");
  const signature = createHmac("sha256", env.AUTH_SECRET).update(encoded).digest("hex");
  await context.addCookies([{ name: "fede_session", value: `${encoded}.${signature}`, url: "http://127.0.0.1:3019", httpOnly: true }]);
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:3019/orders?q=${marker}`, { waitUntil: "networkidle" });
  await page.getByText("61 ordini · Mostrati 1–50", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Successivi →" }).click();
  await page.getByText("61 ordini · Mostrati 51–61", { exact: true }).waitFor();
  if (new URL(page.url()).searchParams.get("q") !== marker) throw Error("Lost search filter");
  await mkdir("output/neon-ui", { recursive: true });
  await page.locator(".orders-page-results-card").screenshot({ path: "output/neon-ui/ordini-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "← Precedenti" }).click();
  await page.getByText("61 ordini · Mostrati 1–50", { exact: true }).waitFor();
  await page.getByRole("navigation", { name: "Pagine ordini" }).screenshot({ path: "output/neon-ui/paginazione-mobile.png" });
  const first = await context.request.get("http://127.0.0.1:3019/api/orders/shop-online/pending");
  const revision = first.headers().etag;
  const next = await context.request.get("http://127.0.0.1:3019/api/orders/shop-online/pending", { headers: { "If-None-Match": revision } });
  if (first.status() !== 200 || next.status() !== 304 || (await next.body()).length) throw Error("Notification validator failed");
  if (errors.length) throw Error(`Browser errors: ${errors.length}`);
  console.log("UI desktop/mobile: 50+11 orders, preserved search, previous/next links and HTTP 304 notifications passed.");
} finally {
  await browser?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGTERM"); await stopped;
  }
  await db.order.deleteMany({ where: { customerId } });
  await db.customer.deleteMany({ where: { id: customerId } });
  await db.$disconnect();
}
