import { del, put } from "@vercel/blob";
import { mkdir, rm, unlink, writeFile } from "fs/promises";
import path from "path";
import { sanitizeAttachmentFileName } from "@/lib/attachment-utils";

export type AttachmentStorageMode = "local" | "blob";

type StoredAttachment = {
  filePath: string;
};

type UploadAttachmentInput = {
  orderId: string;
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

function getLocalUploadsRoot() {
  return path.join(process.cwd(), "public", "uploads", "orders");
}

function isBlobUrl(filePath: string) {
  return /^https?:\/\//i.test(filePath);
}

function isProductionRuntime(nodeEnv?: string) {
  return nodeEnv === "production";
}

export function resolveAttachmentStorageMode(options?: {
  nodeEnv?: string;
  blobToken?: string;
}): AttachmentStorageMode {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const blobToken = options?.blobToken ?? process.env.BLOB_READ_WRITE_TOKEN;

  if (isProductionRuntime(nodeEnv)) {
    return "blob";
  }

  return blobToken ? "blob" : "local";
}

function ensureBlobStorageConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN mancante. Configura Vercel Blob per gli allegati online.");
  }
}

async function uploadToLocalStorage({ orderId, fileName, buffer }: UploadAttachmentInput) {
  const safeName = `${Date.now()}_${sanitizeAttachmentFileName(fileName)}`;
  const uploadDir = path.join(getLocalUploadsRoot(), orderId);
  const filePath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    mode: "local" as const,
    filePath: `/uploads/orders/${orderId}/${safeName}`
  };
}

async function uploadToBlobStorage({ orderId, fileName, mimeType, buffer }: UploadAttachmentInput) {
  ensureBlobStorageConfigured();
  const safeName = `${Date.now()}_${sanitizeAttachmentFileName(fileName)}`;
  const pathname = `orders/${orderId}/${safeName}`;
  const result = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: mimeType || "application/octet-stream"
  });

  return {
    mode: "blob" as const,
    filePath: result.url
  };
}

export async function uploadOrderAttachment(input: UploadAttachmentInput) {
  const mode = resolveAttachmentStorageMode();
  if (mode === "blob") {
    return uploadToBlobStorage(input);
  }

  return uploadToLocalStorage(input);
}

export async function deleteStoredAttachment(filePath: string) {
  if (!filePath) {
    return;
  }

  if (isBlobUrl(filePath)) {
    ensureBlobStorageConfigured();
    await del(filePath);
    return;
  }

  const relativePath = filePath.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  await unlink(absolutePath).catch(() => undefined);
}

export async function cleanupOrderAttachments(attachments: StoredAttachment[]) {
  if (!attachments.length) {
    return;
  }

  const blobPaths = attachments.map((attachment) => attachment.filePath).filter(isBlobUrl);
  if (blobPaths.length > 0) {
    ensureBlobStorageConfigured();
    await del(blobPaths).catch(() => undefined);
  }

  const localAttachments = attachments.filter((attachment) => !isBlobUrl(attachment.filePath));
  if (localAttachments.length > 0) {
    const orderId = localAttachments[0]?.filePath.split("/")[3];
    if (orderId) {
      await rm(path.join(getLocalUploadsRoot(), orderId), {
        recursive: true,
        force: true
      }).catch(() => undefined);
      return;
    }

    await Promise.all(localAttachments.map((attachment) => deleteStoredAttachment(attachment.filePath)));
  }
}
