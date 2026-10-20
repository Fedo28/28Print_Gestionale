import path from "node:path";
import { appendFile, stat, rename, unlink } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { loadConfig, checkDirectories } from "./config.ts";
import { HttpPrintApi } from "./client.ts";
import { Ledger } from "./ledger.ts";
import { Worker } from "./worker.ts";
import { RuntimeStatus } from "./runtime-status.ts";
import { nextPollSeconds } from "./polling.ts";
import { isNightPause } from "./service-hours.ts";

const command = process.argv[2];
if (!["run", "check"].includes(command)) throw new Error("Uso: node src/cli.ts check|run [percorso-config.json]");
const config = await loadConfig(path.resolve(process.argv[3] || "config.json"));
await checkDirectories(config);
if (command === "check") {
  console.log("Configurazione e permessi cartelle verificati. Nessun file depositato nelle Hot Folders e nessuna chiamata al gestionale.");
} else {
  const api = new HttpPrintApi(config.baseUrl, process.env.PRINT_BRIDGE_TOKEN || "", process.env.PRINT_BRIDGE_VERCEL_BYPASS);
  const ledger = new Ledger(path.join(config.workDir, "data"));
  const status = new RuntimeStatus(path.join(config.workDir, "data"));
  const logPath = path.join(config.workDir, "logs/bridge.log");
  const log = async (message: string, jobId?: string) => {
    if ((await stat(logPath).catch(() => null))?.size! > 5 * 1024 * 1024) {
      await unlink(`${logPath}.3`).catch(() => undefined);
      for (let n = 2; n >= 1; n--) await rename(`${logPath}.${n}`, `${logPath}.${n + 1}`).catch(() => undefined);
      await rename(logPath, `${logPath}.1`);
    }
    await appendFile(logPath, JSON.stringify({ time: new Date().toISOString(), event: message, jobId }) + "\n", { mode: 0o600 });
  };
  const worker = new Worker(config, api, ledger, log);
  let stopping = false, failures = 0, emptyCycles = 0;
  const stopWait = new AbortController();
  const stop = () => { stopping = true; stopWait.abort(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    await status.publish("starting");
    await log("Bridge avviato");
    while (!stopping) {
      if (await status.stopRequested()) break;
      try {
        // Finish durable receipts/in-flight jobs; never claim new work at night.
        // With an empty ledger this performs zero HTTP calls.
        const worked = await worker.tick(!isNightPause());
        emptyCycles = worked ? 0 : Math.min(emptyCycles + 1, 5);
        failures = 0;
        await status.publish(isNightPause() ? "night_paused" : "running");
      }
      catch {
        emptyCycles = 0;
        failures++; await status.publish("retrying", failures);
        await log("Comunicazione o registro indisponibili; nessun nuovo deposito autorizzato. Controllare rete e credenziale.");
      }
      // Arresto cooperativo: mai interrompere download/pubblicazione a meta'.
      // Eventuali ricevute persistenti ancora da inviare ripartono al prossimo avvio.
      const wakeAt = Date.now() + (isNightPause() && failures === 0 ? 60 : nextPollSeconds(config.pollSeconds, emptyCycles, failures)) * 1000;
      while (!stopping && Date.now() < wakeAt) {
        if (await status.stopRequested()) { stopping = true; break; }
        await setTimeout(Math.min(1000, Math.max(1, wakeAt - Date.now())), undefined, { signal: stopWait.signal })
          .catch(error => { if (error.name !== "AbortError") throw error; });
      }
    }
  } finally {
    await status.publish("stopped", failures);
    ledger.close();
  }
}
