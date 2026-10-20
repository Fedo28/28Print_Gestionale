import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export type RuntimeState = "starting" | "running" | "retrying" | "stopped" | "night_paused";
// Informazioni diagnostiche soltanto: mai token, manifest, percorsi dei PDF o dati cliente.
// Il registro SQLite resta l'unica autorita' per la consegna dei lavori.
export class RuntimeStatus {
  readonly instanceId = randomUUID();
  private lastSuccessAt: string | null = null;
  private root: string;
  constructor(root: string) { this.root = root; }
  async publish(state: RuntimeState, failures = 0) {
    if (state === "running") this.lastSuccessAt = new Date().toISOString();
    const temp = path.join(this.root, `runtime-status-${this.instanceId}.tmp`);
    try {
      await writeFile(temp, JSON.stringify({ version: 1, instanceId: this.instanceId, pid: process.pid,
        state, updatedAt: new Date().toISOString(), lastSuccessAt: this.lastSuccessAt, failures }), { mode: 0o600 });
      await rename(temp, path.join(this.root, "runtime-status.json"));
    } catch {
      // Un problema al pannello diagnostico non modifica una ricevuta e non provoca reinvii.
      await unlink(temp).catch(() => undefined);
    }
  }
  async stopRequested() {
    try {
      const request = JSON.parse(await readFile(path.join(this.root, "stop-request.json"), "utf8"));
      return request.instanceId === this.instanceId;
    } catch { return false; }
  }
}
