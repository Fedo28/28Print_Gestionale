export const ATTACHMENT_MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_SIZE_BYTES = 100 * 1024 * 1024;

export type AttachmentClientPayload = {
  orderId: string;
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
};

export function sanitizeAttachmentFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "_");
}

export function buildAttachmentBlobPath(orderId: string, fileName: string) {
  return `orders/${orderId}/${Date.now()}_${sanitizeAttachmentFileName(fileName)}`;
}

export function formatAttachmentMaxSize(maxSizeInBytes = ATTACHMENT_MAX_SIZE_BYTES) {
  return `${Math.round(maxSizeInBytes / (1024 * 1024))} MB`;
}

export function formatAttachmentSize(sizeInBytes: number) {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return "0 B";
  }

  if (sizeInBytes < 1024) {
    return `${Math.round(sizeInBytes)} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(sizeInBytes < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(sizeInBytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function parseAttachmentClientPayload(value: string | null | undefined): AttachmentClientPayload {
  if (!value) {
    throw new Error("Dati allegato mancanti.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Dati allegato non validi.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Dati allegato non validi.");
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.orderId !== "string" ||
    typeof candidate.fileName !== "string" ||
    typeof candidate.sizeBytes !== "number"
  ) {
    throw new Error("Dati allegato non validi.");
  }

  const orderId = candidate.orderId.trim();
  const fileName = candidate.fileName.trim();
  const mimeType =
    typeof candidate.mimeType === "string" && candidate.mimeType.trim()
      ? candidate.mimeType.trim()
      : undefined;

  if (!orderId || !fileName || !Number.isFinite(candidate.sizeBytes) || candidate.sizeBytes <= 0) {
    throw new Error("Dati allegato non validi.");
  }

  return {
    orderId,
    fileName,
    mimeType,
    sizeBytes: Math.round(candidate.sizeBytes)
  };
}
