"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_MULTIPART_THRESHOLD_BYTES,
  buildAttachmentBlobPath,
  formatAttachmentMaxSize
} from "@/lib/attachment-utils";

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Upload allegato non riuscito.";
}

export function AttachmentUploadForm({
  orderId,
  useDirectUpload
}: {
  orderId: string;
  useDirectUpload: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!useDirectUpload) {
    return (
      <form
        action={`/api/orders/${orderId}/attachments`}
        className="stack"
        encType="multipart/form-data"
        method="post"
      >
        <input name="file" required type="file" />
        <button className="secondary" type="submit">
          Carica allegato
        </button>
      </form>
    );
  }

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);

        const form = event.currentTarget;
        const formData = new FormData(form);
        const file = formData.get("file");

        if (!(file instanceof File) || file.size === 0) {
          setError("Seleziona un file prima di caricare l'allegato.");
          return;
        }

        if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
          setError(`File troppo grande. Limite ${formatAttachmentMaxSize()}.`);
          return;
        }

        setIsUploading(true);
        setProgress(0);

        try {
          await upload(buildAttachmentBlobPath(orderId, file.name), file, {
            access: "public",
            handleUploadUrl: `/api/orders/${orderId}/attachments`,
            clientPayload: JSON.stringify({
              orderId,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size
            }),
            multipart: file.size > ATTACHMENT_MULTIPART_THRESHOLD_BYTES,
            onUploadProgress: ({ percentage }) => {
              setProgress(Math.round(percentage));
            }
          });

          form.reset();
          startTransition(() => {
            router.refresh();
          });
        } catch (uploadError) {
          setError(getUploadErrorMessage(uploadError));
        } finally {
          setIsUploading(false);
          setProgress(null);
        }
      }}
    >
      <input disabled={isUploading} name="file" required type="file" />
      <button className="secondary" disabled={isUploading} type="submit">
        {isUploading ? `Caricamento ${progress ?? 0}%` : "Carica allegato"}
      </button>
      <p className="hint">Upload diretto su Vercel Blob. Limite {formatAttachmentMaxSize()}.</p>
      {error ? <div className="empty">{error}</div> : null}
    </form>
  );
}
