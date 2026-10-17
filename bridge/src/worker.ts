import { randomUUID } from "node:crypto";
import { link, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BridgeConfig } from "./config.ts";
import { Ledger, type Entry } from "./ledger.ts";
import { ApiError, type PrintApi } from "./client.ts";
import { inspectPdf } from "./pdf.ts";
import { validateManifest, type Report } from "./protocol.ts";

export class Worker {
  constructor(privateConfig: BridgeConfig, privateApi: PrintApi, privateLedger: Ledger, log: (event: string, id?: string) => Promise<void>) {
    this.config = privateConfig; this.api = privateApi; this.ledger = privateLedger; this.log = log;
  }
  private config: BridgeConfig;
  private api: PrintApi;
  private ledger: Ledger;
  private log: (event: string, id?: string) => Promise<void>;
  // Test seam: throws to simulate a crash after the irreversible filesystem publication.
  afterPublication?: () => void;
  private finish(entry: Entry, outcome: Report["outcome"], detail: string) {
    entry.phase = outcome;
    entry.report = { jobId: entry.id, claimToken: entry.manifest.claimToken, dispatchId: entry.dispatchId, outcome, detail };
    entry.acked = false; this.ledger.save(entry);
  }
  async tick() {
    for (const entry of this.ledger.pending()) {
      if (entry.phase === "DISPATCH_INTENT") this.finish(entry, "NEEDS_REVIEW", "Riavvio/interruzione durante l'invio: controllare Fiery. Nessun nuovo deposito eseguito.");
      if (entry.report) {
        try { await this.api.report(entry.report); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error;
          // A newer server state/claim fences this receipt. Preserve local history; never deposit again.
          await this.log("Ricevuta rifiutata per stato superato: verificare dal gestionale", entry.id);
        }
        entry.acked = true; this.ledger.save(entry);
        await this.log(entry.phase, entry.id);
      } else if (entry.phase === "PREPARING") { await this.process(entry); return; }
    }
    const raw = await this.api.claim(Object.keys(this.config.destinations));
    if (!raw) return;
    const job = validateManifest(raw);
    const previous = this.ledger.get(job.id);
    if (previous) {
      // Includes lost/rebuilt server leases. A known job ID can never reach filesystem publication again.
      await this.api.report({ jobId: job.id, claimToken: job.claimToken, outcome: "ERROR", detail: "Identificativo già presente nel registro locale: richiede verifica e nuova autorizzazione." });
      return;
    }
    const entry: Entry = { id: job.id, manifest: job, phase: "PREPARING", acked: false };
    this.ledger.save(entry);
    await this.process(entry);
  }
  private async process(entry: Entry) {
    const job = entry.manifest;
    const destination = this.config.destinations[job.destinationKey];
    let stage: string | undefined;
    try {
      if (!destination || destination.profileKey !== job.profileKey || !destination.verifiedHoldOneCopy) throw new Error("Destinazione non configurata o non verificata.");
      await this.api.renew(job);
      const bytes = await this.api.download(job);
      const inspected = await inspectPdf(bytes);
      if (inspected.sha256 !== job.sha256 || inspected.fileSize !== job.fileSize) throw new Error("Impronta PDF diversa dalla revisione approvata.");
      // Unique staging file, outside the watched directory. Never write a partial file in the Hot Folder.
      stage = path.join(destination.staging, `${job.id}-${randomUUID()}.pdf`);
      const handle = await open(stage, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await this.api.renew(job);
      entry.phase = "DISPATCH_INTENT"; entry.dispatchId = randomUUID(); this.ledger.save(entry);
      await this.api.begin(job, entry.dispatchId);
      // link() is atomic, fails if target exists and requires the same volume. No copy/rename fallback.
      await link(stage, path.join(destination.hotFolder, `28PRINT-${job.id}.pdf`));
      this.afterPublication?.();
      this.finish(entry, "DELIVERED", "PDF completo depositato nella Hot Folder. Stampa fisica non verificata.");
      await this.log("DELIVERED", job.id);
    } catch (error) {
      // A logging/reporting failure must never overwrite a durable delivery receipt.
      if (entry.phase === "DELIVERED") throw error;
      const uncertain = entry.phase === "DISPATCH_INTENT";
      const message = uncertain ? "Esito deposito incerto: controllare Fiery e il registro locale prima di un nuovo invio."
        : error instanceof ApiError ? error.message : "Preparazione PDF fallita: controllare formato A4, integrità, dimensioni e cartelle.";
      this.finish(entry, uncertain ? "NEEDS_REVIEW" : "ERROR", message);
      await writeFile(path.join(this.config.workDir, "errors", `${job.id}.json`), JSON.stringify(entry.report, null, 2), { mode: 0o600 });
      await this.log(entry.phase, job.id);
    } finally {
      if (stage) await unlink(stage).catch(() => undefined);
    }
    // Report on the next tick. If interrupted here, the durable outbox resumes without another file delivery.
  }
}
