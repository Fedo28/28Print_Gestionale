import { ATTACHMENT_MAX_SIZE_BYTES, sanitizeAttachmentFileName } from "@/lib/attachment-utils";

export const SHOP_FILE_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg"] as const;
export const SHOP_FILE_ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg"] as const;
export const SHOP_FILE_DEFAULT_RETENTION_DAYS = 60;
export const SHOP_FILE_MAX_SIZE_BYTES = ATTACHMENT_MAX_SIZE_BYTES;

export type ShopFileMimeType = (typeof SHOP_FILE_ALLOWED_MIME_TYPES)[number];

export type ShopFileCandidateValidationResult = {
  valid: boolean;
  errors: string[];
  normalizedFileName: string;
  normalizedMimeType: ShopFileMimeType | null;
};

type ShopFileCandidate = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  maxSizeBytes?: number;
};

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function isShopFileMimeTypeAllowed(value: string | null | undefined): value is ShopFileMimeType {
  return SHOP_FILE_ALLOWED_MIME_TYPES.includes(String(value || "").trim().toLowerCase() as ShopFileMimeType);
}

export function isShopFileExtensionAllowed(fileName: string) {
  const extension = getFileExtension(fileName);
  return SHOP_FILE_ALLOWED_EXTENSIONS.some((allowedExtension) => allowedExtension === extension);
}

export function resolveShopFileExpiresAt(
  createdAt: Date | string,
  retentionDays = SHOP_FILE_DEFAULT_RETENTION_DAYS
) {
  const baseDate = createdAt instanceof Date ? new Date(createdAt.getTime()) : new Date(createdAt);
  const safeRetentionDays = Number.isFinite(retentionDays) ? Math.max(1, Math.round(retentionDays)) : SHOP_FILE_DEFAULT_RETENTION_DAYS;
  return new Date(baseDate.getTime() + safeRetentionDays * 24 * 60 * 60 * 1000);
}

export function validateShopFileCandidate(input: ShopFileCandidate): ShopFileCandidateValidationResult {
  const normalizedFileName = sanitizeAttachmentFileName(String(input.fileName || "").trim());
  const normalizedMimeType = String(input.mimeType || "").trim().toLowerCase();
  const maxSizeBytes =
    Number.isFinite(input.maxSizeBytes) && Number(input.maxSizeBytes) > 0
      ? Math.round(Number(input.maxSizeBytes))
      : SHOP_FILE_MAX_SIZE_BYTES;
  const errors: string[] = [];

  if (!normalizedFileName) {
    errors.push("Il nome file e obbligatorio.");
  }

  if (!isShopFileExtensionAllowed(normalizedFileName)) {
    errors.push("Formato file non supportato. Usa PDF o JPG.");
  }

  if (!isShopFileMimeTypeAllowed(normalizedMimeType)) {
    errors.push("Mime type non supportato per il file di stampa.");
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    errors.push("Dimensione file non valida.");
  } else if (input.sizeBytes > maxSizeBytes) {
    errors.push(`File troppo grande. Limite iniziale ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedFileName,
    normalizedMimeType: isShopFileMimeTypeAllowed(normalizedMimeType) ? normalizedMimeType : null
  };
}

export function buildShopFileAssetStorageKey(input: {
  customerId: string;
  salesOrderId?: string | null;
  salesOrderItemId?: string | null;
  fileName: string;
  now?: Date;
}) {
  const customerId = String(input.customerId || "").trim();
  const fileName = String(input.fileName || "").trim();

  if (!customerId) {
    throw new Error("customerId obbligatorio per il file asset shop.");
  }

  if (!fileName) {
    throw new Error("fileName obbligatorio per il file asset shop.");
  }

  const safeName = sanitizeAttachmentFileName(fileName);
  const timestamp = input.now instanceof Date ? input.now.getTime() : Date.now();
  const salesOrderId = String(input.salesOrderId || "").trim();
  const salesOrderItemId = String(input.salesOrderItemId || "").trim();
  const orderSegments = salesOrderId ? ["orders", salesOrderId] : ["orders", "pending"];
  const itemSegments = salesOrderItemId ? ["items", salesOrderItemId] : ["items", "pending"];

  return ["shop", "customers", customerId, ...orderSegments, ...itemSegments, `${timestamp}_${safeName}`].join("/");
}
