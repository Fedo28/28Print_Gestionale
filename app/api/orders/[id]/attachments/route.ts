import { handleUpload } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  formatAttachmentMaxSize,
  parseAttachmentClientPayload
} from "@/lib/attachment-utils";
import { registerAttachment } from "@/lib/orders";
import { deleteStoredAttachment, resolveAttachmentStorageMode, uploadOrderAttachment } from "@/lib/storage";

export const runtime = "nodejs";

async function handleDirectBlobUpload(request: NextRequest, orderId: string) {
  if (resolveAttachmentStorageMode() !== "blob") {
    return NextResponse.json(
      {
        error: "Upload diretto non disponibile senza Vercel Blob configurato."
      },
      { status: 400 }
    );
  }

  try {
    const payload = await handleUpload({
      request,
      body: await request.json(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!readSession(request.cookies.get("fede_session")?.value)) {
          throw new Error("Sessione non valida.");
        }

        const attachment = parseAttachmentClientPayload(clientPayload);
        if (attachment.orderId !== orderId) {
          throw new Error("Ordine non valido.");
        }

        if (!pathname.startsWith(`orders/${orderId}/`)) {
          throw new Error("Percorso allegato non valido.");
        }

        return {
          addRandomSuffix: false,
          maximumSizeInBytes: ATTACHMENT_MAX_SIZE_BYTES,
          tokenPayload: JSON.stringify(attachment)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const attachment = parseAttachmentClientPayload(tokenPayload);

        try {
          await registerAttachment(
            orderId,
            attachment.fileName,
            blob.url,
            attachment.mimeType || blob.contentType || "application/octet-stream",
            attachment.sizeBytes
          );
        } catch (error) {
          await deleteStoredAttachment(blob.url).catch(() => undefined);
          throw error;
        }
      }
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload allegato non riuscito."
      },
      { status: 400 }
    );
  }
}

async function handleServerUpload(request: NextRequest, orderId: string) {
  try {
    if (!readSession(request.cookies.get("fede_session")?.value)) {
      return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File mancante." }, { status: 400 });
    }

    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File troppo grande. Limite ${formatAttachmentMaxSize()}.`
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const stored = await uploadOrderAttachment({
      orderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer
    });

    try {
      await registerAttachment(orderId, file.name, stored.filePath, file.type || "application/octet-stream", file.size);
    } catch (error) {
      await deleteStoredAttachment(stored.filePath).catch(() => undefined);
      throw error;
    }

    return NextResponse.redirect(new URL(`/orders/${orderId}`, request.url), 303);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload allegato non riuscito."
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return handleDirectBlobUpload(request, params.id);
  }

  if (contentType.includes("multipart/form-data")) {
    return handleServerUpload(request, params.id);
  }

  return NextResponse.json({ error: "Tipo richiesta non supportato." }, { status: 415 });
}
