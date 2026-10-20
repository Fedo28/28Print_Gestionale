import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { inspectPdf } from "@/bridge/src/pdf";
import { MAX_PDF_BYTES } from "@/bridge/src/protocol";
import { isLocalPrintTest } from "@/lib/print-runtime";

// Only locators stored by the existing attachment system are accepted. Never fetch a client-supplied URL.
export async function readPrintSource(locator: string) {
  let bytes: Uint8Array;
  if (locator.startsWith("/uploads/orders/") && isLocalPrintTest()) {
    const root = await realpath(path.join(process.cwd(), "public/uploads/orders"));
    const target = await realpath(path.join(process.cwd(), "public", locator));
    if (!target.startsWith(root + path.sep)) throw new Error("Percorso allegato non valido.");
    bytes = await readFile(target);
  } else {
    const url = new URL(locator);
    const allowed = (process.env.PRINT_BRIDGE_BLOB_HOSTS || "").split(",").map(x => x.trim()).filter(Boolean);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname) ||
      !url.hostname.endsWith(".public.blob.vercel-storage.com") || !url.pathname.startsWith("/orders/")) {
      throw new Error("Storage allegato non autorizzato nell'ambiente di test.");
    }
    const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body || Number(response.headers.get("content-length") || 0) > MAX_PDF_BYTES) throw new Error("Download allegato non disponibile.");
    const chunks: Uint8Array[] = []; let length = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > MAX_PDF_BYTES) throw new Error("PDF oltre il limite del prototipo.");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    bytes = Buffer.concat(chunks);
  }
  return { bytes, ...await inspectPdf(bytes) };
}
