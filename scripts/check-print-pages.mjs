// Smoke test against the built app, exclusively with the isolated local fixture.
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { verifyPrintTestIsolation } from "./print-test-env.mjs";
const env = await verifyPrintTestIsolation();
env.NODE_ENV = "production";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3016"], { env, stdio: ["ignore", "pipe", "pipe"] });
let ready = false;
child.stdout.on("data", chunk => { if (String(chunk).includes("Ready in")) ready = true; });
child.stderr.on("data", () => {}); // Never dump runtime configuration in diagnostic output.
try {
  const deadline = Date.now() + 30000;
  while (!ready && child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (!ready || child.exitCode !== null) throw Error("Server locale non disponibile.");
  const encoded = Buffer.from(JSON.stringify({ userId: "print-test-admin", role: "ADMIN", exp: Date.now() + 60000 })).toString("base64url");
  const signature = createHmac("sha256", env.AUTH_SECRET).update(encoded).digest("hex");
  const cookie = `fede_session=${encoded}.${signature}`;
  for (const [url, expected] of [
    ["/settings/printing", ["Stampanti e smistamento", "Profili di lavorazione", "Crea destinazione disabilitata"]],
    ["/orders/print-test-order", ["Invia a Fiery", "Da inviare"]],
    ["/whatsapp", ["Numero non collegato", "Conversazioni", "Collegamento Meta da completare"]],
    ["/orders/print-test-order/fiery?attachment=print-test-attachment", ["Profilo di stampa", "Stampante / Hot Folder", "consigliata"]]
  ]) {
    const response = await fetch(`http://127.0.0.1:3016${url}`, { headers: { Cookie: cookie }, redirect: "error", signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    if (response.status !== 200 || expected.some(text => !html.includes(text)) || html.includes(env.AUTH_SECRET) || html.includes(cookie)) throw Error(`Verifica pagina fallita: ${url}`);
    console.log(`HTTP 200 e controlli presenti: ${url}`);
  }
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGTERM"); await stopped;
  }
}
