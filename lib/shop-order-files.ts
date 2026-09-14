import { Prisma } from "@prisma/client";
import {
  buildShopFileAssetStorageKey,
  resolveShopFileExpiresAt,
  validateShopFileCandidate
} from "@/lib/domain/files/shop-file-assets";
import { prisma } from "@/lib/prisma";
import { deletePrivateShopFile, readPrivateShopFile, uploadPrivateShopFile } from "@/lib/storage";

export const customerShopSalesOrderItemFileSelect = {
  id: true,
  createdAt: true,
  fileAsset: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      fileSize: true,
      visibility: true,
      expiresAt: true,
      createdAt: true
    }
  }
} satisfies Prisma.SalesOrderItemFileSelect;

const customerShopFileAssetSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  visibility: true,
  expiresAt: true,
  createdAt: true
} satisfies Prisma.FileAssetSelect;

const customerShopFileDownloadSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  storageProvider: true,
  storageKey: true,
  storagePath: true,
  expiresAt: true
} satisfies Prisma.FileAssetSelect;

export type CustomerShopFileAsset = Prisma.FileAssetGetPayload<{
  select: typeof customerShopFileAssetSelect;
}>;

export type CustomerShopOrderFileDownload = Prisma.FileAssetGetPayload<{
  select: typeof customerShopFileDownloadSelect;
}>;

function isKnownShopOrderFileMessage(message: string) {
  return (
    [
      "Sessione cliente non valida.",
      "Ordine shop non disponibile.",
      "Riga ordine shop non disponibile.",
      "File di stampa mancante.",
      "Storage file shop non ancora disponibile per il download.",
      "File shop scaduto."
    ].includes(message) ||
    /^Il nome file e obbligatorio\.$/.test(message) ||
    /^Formato file non supportato\. Usa PDF o JPG\.$/.test(message) ||
    /^Mime type non supportato per il file di stampa\.$/.test(message) ||
    /^Dimensione file non valida\.$/.test(message) ||
    /^File troppo grande\. Limite iniziale \d+ MB\.$/.test(message)
  );
}

export function describeShopOrderFileFailure(error: unknown) {
  if (error instanceof Error && isKnownShopOrderFileMessage(error.message)) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database shop non raggiungibile. Controlla l'ambiente di sviluppo.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return "Schema shop non ancora applicato. Esegui prima le migrazioni Prisma.";
  }

  return "Upload file shop non riuscito.";
}

async function resolveCustomerShopOrderFileTarget(input: {
  customerAccountId: string;
  salesOrderId: string;
  salesOrderItemId?: string | null;
}) {
  const customerAccountId = String(input.customerAccountId || "").trim();
  const salesOrderId = String(input.salesOrderId || "").trim();
  const salesOrderItemId = String(input.salesOrderItemId || "").trim();

  if (!customerAccountId) {
    throw new Error("Sessione cliente non valida.");
  }

  const order = await prisma.salesOrder.findFirst({
    where: {
      id: salesOrderId,
      customerAccountId
    },
    select: {
      id: true,
      customerId: true,
      items: {
        where: salesOrderItemId ? { id: salesOrderItemId } : undefined,
        orderBy: [{ createdAt: "asc" }],
        take: 1,
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Ordine shop non disponibile.");
  }

  const orderItem = order.items[0] || null;
  if (!orderItem) {
    throw new Error("Riga ordine shop non disponibile.");
  }

  return {
    customerId: order.customerId,
    salesOrderId: order.id,
    salesOrderItemId: orderItem.id
  };
}

export async function uploadCustomerShopOrderFile(input: {
  customerAccountId: string;
  salesOrderId: string;
  salesOrderItemId?: string | null;
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  buffer: Buffer;
}) {
  const validation = validateShopFileCandidate({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes
  });

  if (!validation.valid) {
    throw new Error(validation.errors[0] || "File di stampa mancante.");
  }

  const target = await resolveCustomerShopOrderFileTarget({
    customerAccountId: input.customerAccountId,
    salesOrderId: input.salesOrderId,
    salesOrderItemId: input.salesOrderItemId
  });

  const createdAt = new Date();
  const storageKey = buildShopFileAssetStorageKey({
    customerId: target.customerId,
    salesOrderId: target.salesOrderId,
    salesOrderItemId: target.salesOrderItemId,
    fileName: validation.normalizedFileName,
    now: createdAt
  });
  const stored = await uploadPrivateShopFile({
    storageKey,
    buffer: input.buffer
  });

  try {
    const fileAsset = await prisma.$transaction(async (tx) => {
      const createdFileAsset = await tx.fileAsset.create({
        data: {
          ownerCustomerId: target.customerId,
          uploadedByCustomerAccountId: String(input.customerAccountId || "").trim(),
          originalName: validation.normalizedFileName,
          mimeType: validation.normalizedMimeType || "application/octet-stream",
          fileSize: Math.round(Number(input.sizeBytes) || 0),
          storageProvider: stored.storageProvider,
          storageKey,
          storagePath: stored.storagePath,
          visibility: "PRIVATE",
          expiresAt: resolveShopFileExpiresAt(createdAt)
        },
        select: customerShopFileAssetSelect
      });

      await tx.salesOrderItemFile.create({
        data: {
          salesOrderItemId: target.salesOrderItemId,
          fileAssetId: createdFileAsset.id
        }
      });

      await tx.domainEvent.create({
        data: {
          topic: "shop.file_asset.created",
          entityType: "FileAsset",
          entityId: createdFileAsset.id,
          dedupeKey: `shop.file_asset.created:${createdFileAsset.id}`,
          payloadJson: {
            fileAssetId: createdFileAsset.id,
            salesOrderId: target.salesOrderId,
            salesOrderItemId: target.salesOrderItemId,
            customerAccountId: String(input.customerAccountId || "").trim(),
            customerId: target.customerId,
            originalName: createdFileAsset.originalName,
            mimeType: createdFileAsset.mimeType,
            fileSize: createdFileAsset.fileSize
          }
        }
      });

      return createdFileAsset;
    });

    return {
      salesOrderId: target.salesOrderId,
      salesOrderItemId: target.salesOrderItemId,
      fileAsset
    };
  } catch (error) {
    await deletePrivateShopFile(stored.storagePath).catch(() => undefined);
    throw error;
  }
}

export async function getCustomerShopOrderFileDownload(fileAssetId: string, customerAccountId: string) {
  return prisma.fileAsset.findFirst({
    where: {
      id: String(fileAssetId || "").trim(),
      salesOrderItems: {
        some: {
          salesOrderItem: {
            salesOrder: {
              customerAccountId: String(customerAccountId || "").trim()
            }
          }
        }
      }
    },
    select: customerShopFileDownloadSelect
  });
}

export async function readCustomerShopOrderFile(fileAssetId: string, customerAccountId: string) {
  const fileAsset = await getCustomerShopOrderFileDownload(fileAssetId, customerAccountId);
  if (!fileAsset) {
    throw new Error("Ordine shop non disponibile.");
  }

  if (fileAsset.expiresAt && fileAsset.expiresAt.getTime() < Date.now()) {
    throw new Error("File shop scaduto.");
  }

  if (fileAsset.storageProvider !== "local-private" || !fileAsset.storagePath) {
    throw new Error("Storage file shop non ancora disponibile per il download.");
  }

  return {
    buffer: await readPrivateShopFile(fileAsset.storagePath),
    fileAsset
  };
}
