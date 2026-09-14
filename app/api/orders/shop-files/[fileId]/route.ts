import { NextResponse } from "next/server";
import { sanitizeAttachmentFileName } from "@/lib/attachment-utils";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readPrivateShopFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { fileId: string } }) {
  await requireAuth();

  const fileAsset = await prisma.fileAsset.findFirst({
    where: {
      id: String(params.fileId || "").trim(),
      salesOrderItems: {
        some: {
          salesOrderItem: {
            salesOrder: {
              jobLinks: {
                some: {}
              }
            }
          }
        }
      }
    },
    select: {
      originalName: true,
      mimeType: true,
      fileSize: true,
      storageProvider: true,
      storagePath: true
    }
  });

  if (!fileAsset || fileAsset.storageProvider !== "local-private" || !fileAsset.storagePath) {
    return NextResponse.json({ error: "File shop non disponibile." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readPrivateShopFile(fileAsset.storagePath);
  } catch {
    return NextResponse.json({ error: "File shop non disponibile." }, { status: 404 });
  }

  const safeFileName = sanitizeAttachmentFileName(fileAsset.originalName);
  const encodedFileName = encodeURIComponent(fileAsset.originalName);

  return new NextResponse(buffer, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
      "Content-Length": String(buffer.byteLength),
      "Content-Type": fileAsset.mimeType || "application/octet-stream"
    }
  });
}
