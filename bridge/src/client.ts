import { MAX_PDF_BYTES, validateManifest, type PrintManifest, type Report } from "./protocol.ts";

export class ApiError extends Error {
  status: number;
  constructor(status: number) { super(`Gestionale: HTTP ${status}. Controllare stato, credenziale e configurazione.`); this.status = status; }
}
export interface PrintApi {
  claim(destinations: string[]): Promise<PrintManifest | null>;
  renew(job: PrintManifest): Promise<void>;
  download(job: PrintManifest): Promise<Uint8Array>;
  begin(job: PrintManifest, dispatchId: string): Promise<void>;
  report(report: Report): Promise<void>;
}
export class HttpPrintApi implements PrintApi {
  private origin: string;
  private token: string;
  private vercelBypass?: string;
  constructor(origin: string, token: string, vercelBypass?: string) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error("Credenziale Bridge assente o non valida.");
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) {
      throw new Error("Origine gestionale non valida.");
    }
    if (vercelBypass !== undefined && (!/^[A-Za-z0-9_-]{16,512}$/.test(vercelBypass) || url.protocol !== "https:")) {
      throw new Error("Credenziale automazione Vercel non valida o connessione non HTTPS.");
    }
    this.vercelBypass = vercelBypass;
    this.origin = url.origin; this.token = token;
  }
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.token}`, ...extra,
      ...(this.vercelBypass ? { "x-vercel-protection-bypass": this.vercelBypass } : {}) };
  }
  private async post(body: object) {
    const response = await fetch(`${this.origin}/api/print-bridge`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: this.headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
    if (!response.ok) throw new ApiError(response.status);
    return await response.json() as { job?: unknown };
  }
  async claim(destinations: string[]) { const body = await this.post({ operation: "claim", destinations }); return body.job ? validateManifest(body.job) : null; }
  async renew(job: PrintManifest) { await this.post({ operation: "renew", jobId: job.id, claimToken: job.claimToken }); }
  async begin(job: PrintManifest, dispatchId: string) { await this.post({ operation: "begin", jobId: job.id, claimToken: job.claimToken, dispatchId }); }
  async report(report: Report) { await this.post({ operation: "report", ...report }); }
  async download(job: PrintManifest) {
    const response = await fetch(`${this.origin}/api/print-bridge/jobs/${job.id}/file`, { redirect: "error", signal: AbortSignal.timeout(45000),
      headers: this.headers({ "X-Print-Lease": job.claimToken }) });
    if (!response.ok) throw new ApiError(response.status);
    if (!response.body || !response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error("Risposta download non valida.");
    const reader = response.body.getReader(); let size = 0; const parts: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_PDF_BYTES || size > job.fileSize) throw new Error("Download oltre la dimensione autorizzata.");
        parts.push(value);
      }
    } finally { await reader.cancel(); }
    if (size !== job.fileSize) throw new Error("Download incompleto.");
    return Buffer.concat(parts);
  }
}
