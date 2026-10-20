import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { MAX_PDF_BYTES } from "./protocol.ts";

export async function inspectPdf(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") {
    throw new Error("Serve un PDF valido, massimo 20 MB per il prototipo.");
  }
  let pdf: PDFDocument;
  try { pdf = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true }); }
  catch { throw new Error("PDF non leggibile o protetto: verificare il documento."); }
  if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 500) throw new Error("PDF protetto, vuoto o oltre 500 pagine.");
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const short = Math.min(width, height), long = Math.max(width, height);
    if (Math.abs(short - 595.276) > 3 || Math.abs(long - 841.89) > 3) throw new Error("Il prototipo accetta soltanto pagine PDF A4.");
  }
  return { sha256: createHash("sha256").update(bytes).digest("hex"), pageCount: pdf.getPageCount(), fileSize: bytes.length };
}
