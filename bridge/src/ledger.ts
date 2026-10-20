import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import type { PrintManifest, Report } from "./protocol.ts";

export type Phase = "PREPARING" | "DISPATCH_INTENT" | "DELIVERED" | "ERROR" | "NEEDS_REVIEW";
export type Entry = { id: string; manifest: PrintManifest; phase: Phase; dispatchId?: string; report?: Report; acked: boolean };
export class Ledger {
  private db: DatabaseSync;
  private lock: DatabaseSync;
  constructor(root: string) {
    // Separate DB: OS releases the exclusive instance lock on process death, while ledger commits remain durable.
    this.lock = new DatabaseSync(path.join(root, "instance.sqlite"));
    try { this.lock.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE"); }
    catch { this.lock.close(); throw new Error("Un'altra istanza del Bridge è già attiva."); }
    this.db = new DatabaseSync(path.join(root, "ledger.sqlite"));
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
  }
  save(entry: Entry) {
    this.db.prepare("INSERT INTO jobs(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(entry.id, JSON.stringify(entry));
  }
  get(id: string): Entry | undefined {
    const row = this.db.prepare("SELECT payload FROM jobs WHERE id=?").get(id) as { payload: string } | undefined;
    return row ? JSON.parse(String(row.payload)) as Entry : undefined;
  }
  pending(): Entry[] {
    const rows = this.db.prepare("SELECT payload FROM jobs ORDER BY rowid").all() as { payload: string }[];
    return rows.map(row => JSON.parse(row.payload) as Entry).filter(row => !row.acked);
  }
  close() { this.db.close(); this.lock.exec("ROLLBACK"); this.lock.close(); }
}
