import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  buildAttachmentBlobPath,
  formatAttachmentSize,
  parseAttachmentClientPayload,
  sanitizeAttachmentFileName
} from "@/lib/attachment-utils";

describe("attachment utils", () => {
  it("sanitizes attachment file names", () => {
    expect(sanitizeAttachmentFileName("Preventivo cliente #1.pdf")).toBe("Preventivo_cliente_1.pdf");
  });

  it("builds blob paths inside the order folder", () => {
    const pathname = buildAttachmentBlobPath("order-123", "Brief cliente.pdf");
    expect(pathname).toMatch(/^orders\/order-123\/\d+_Brief_cliente.pdf$/);
  });

  it("parses valid upload payloads", () => {
    expect(
      parseAttachmentClientPayload(
        JSON.stringify({
          orderId: "order-123",
          fileName: "scheda.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234
        })
      )
    ).toEqual({
      orderId: "order-123",
      fileName: "scheda.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234
    });
  });

  it("rejects invalid payloads", () => {
    expect(() => parseAttachmentClientPayload(null)).toThrow("Dati allegato mancanti.");
    expect(() => parseAttachmentClientPayload(JSON.stringify({ orderId: "", fileName: "a.pdf", sizeBytes: 0 }))).toThrow(
      "Dati allegato non validi."
    );
  });

  it("keeps the upload cap aligned with the deploy guardrail", () => {
    expect(ATTACHMENT_MAX_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });

  it("formats attachment sizes for the upload ui", () => {
    expect(formatAttachmentSize(980)).toBe("980 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
