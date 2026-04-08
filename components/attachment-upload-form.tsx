"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_MULTIPART_THRESHOLD_BYTES,
  buildAttachmentBlobPath,
  formatAttachmentMaxSize,
  formatAttachmentSize
} from "@/lib/attachment-utils";

type QueuedAttachment = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  progress: number | null;
  error: string | null;
};

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Upload allegato non riuscito.";
}

function buildQueuedAttachmentId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

async function uploadWithServerFallback(orderId: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`/api/orders/${orderId}/attachments?ajax=1`, {
    method: "POST",
    body: formData,
    headers: {
      "x-upload-mode": "ajax"
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Upload allegato non riuscito.");
  }
}

function AttachmentSubmitButton({
  disabled,
  isUploading,
  queuedCount
}: {
  disabled: boolean;
  isUploading: boolean;
  queuedCount: number;
}) {
  return (
    <button className="secondary" disabled={disabled} type="submit">
      {isUploading
        ? "Caricamento in corso..."
        : queuedCount > 1
          ? `Carica ${queuedCount} file`
          : "Carica allegato"}
    </button>
  );
}

export function AttachmentUploadForm({
  orderId,
  useDirectUpload
}: {
  orderId: string;
  useDirectUpload: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queuedAttachments, setQueuedAttachments] = useState<QueuedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  function appendFiles(fileList: FileList | File[]) {
    const nextEntries: QueuedAttachment[] = [];
    const skippedFiles: string[] = [];

    Array.from(fileList).forEach((file, index) => {
      if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
        skippedFiles.push(`${file.name} supera ${formatAttachmentMaxSize()}`);
        return;
      }

      nextEntries.push({
        id: buildQueuedAttachmentId(file, index),
        file,
        status: "queued",
        progress: null,
        error: null
      });
    });

    if (nextEntries.length > 0) {
      setQueuedAttachments((current) => {
        const knownIds = new Set(current.map((entry) => entry.id));
        return current.concat(nextEntries.filter((entry) => !knownIds.has(entry.id)));
      });
      setSuccessMessage(null);
    }

    if (skippedFiles.length > 0) {
      setError(skippedFiles.join(" • "));
    } else {
      setError(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function uploadQueuedAttachments() {
    const queue = queuedAttachments.filter((entry) => entry.status === "queued" || entry.status === "error");
    if (queue.length === 0) {
      setError("Seleziona almeno un file prima di caricare gli allegati.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    let successCount = 0;

    for (const entry of queue) {
      setQueuedAttachments((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                status: "uploading",
                progress: 0,
                error: null
              }
            : item
        )
      );

      try {
        if (useDirectUpload) {
          await upload(buildAttachmentBlobPath(orderId, entry.file.name), entry.file, {
            access: "public",
            handleUploadUrl: `/api/orders/${orderId}/attachments`,
            clientPayload: JSON.stringify({
              orderId,
              fileName: entry.file.name,
              mimeType: entry.file.type || "application/octet-stream",
              sizeBytes: entry.file.size
            }),
            multipart: entry.file.size > ATTACHMENT_MULTIPART_THRESHOLD_BYTES,
            onUploadProgress: ({ percentage }) => {
              setQueuedAttachments((current) =>
                current.map((item) =>
                  item.id === entry.id
                    ? {
                        ...item,
                        progress: Math.round(percentage)
                      }
                    : item
                )
              );
            }
          });
        } else {
          await uploadWithServerFallback(orderId, entry.file);
        }

        successCount += 1;
        setQueuedAttachments((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: "done",
                  progress: 100,
                  error: null
                }
              : item
          )
        );
      } catch (uploadError) {
        const message = getUploadErrorMessage(uploadError);
        setQueuedAttachments((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: "error",
                  progress: null,
                  error: message
                }
              : item
          )
        );
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      setSuccessMessage(
        successCount === 1 ? "Allegato caricato con successo." : `${successCount} allegati caricati con successo.`
      );
      setQueuedAttachments((current) => current.filter((entry) => entry.status !== "done"));
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="stack attachment-upload-panel">
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          await uploadQueuedAttachments();
        }}
      >
        <label
          className={`attachment-dropzone${isDragActive ? " drag-over" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
              setIsDragActive(false);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDragActive(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            appendFiles(event.dataTransfer.files);
          }}
        >
          <input
            disabled={isUploading}
            multiple
            name="file"
            onChange={(event) => appendFiles(event.currentTarget.files || [])}
            ref={fileInputRef}
            type="file"
          />
          <strong>Trascina qui i file oppure tocca per sceglierli</strong>
          <span className="subtle">
            Upload {useDirectUpload ? "diretto" : "server"} • fino a {formatAttachmentMaxSize()} per file
          </span>
        </label>

        {queuedAttachments.length > 0 ? (
          <div className="mini-list attachment-upload-queue">
            {queuedAttachments.map((entry) => (
              <article className="mini-item attachment-upload-item" key={entry.id}>
                <div className="list-header">
                  <div>
                    <strong>{entry.file.name}</strong>
                    <div className="subtle">{formatAttachmentSize(entry.file.size)}</div>
                  </div>
                  <div className="attachment-upload-item-actions">
                    <span className={`pill ${entry.status === "error" ? "danger" : entry.status === "done" ? "status" : "warning"}`}>
                      {entry.status === "queued"
                        ? "In coda"
                        : entry.status === "uploading"
                          ? `${entry.progress ?? 0}%`
                          : entry.status === "done"
                            ? "Caricato"
                            : "Errore"}
                    </span>
                    {entry.status !== "uploading" ? (
                      <button
                        className="button ghost"
                        onClick={() => {
                          setQueuedAttachments((current) => current.filter((item) => item.id !== entry.id));
                        }}
                        type="button"
                      >
                        Rimuovi
                      </button>
                    ) : null}
                  </div>
                </div>
                {entry.error ? <div className="hint">{entry.error}</div> : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="button-row attachment-upload-actions">
          <AttachmentSubmitButton
            disabled={isUploading || queuedAttachments.length === 0}
            isUploading={isUploading}
            queuedCount={queuedAttachments.length}
          />
          {queuedAttachments.length > 0 ? (
            <button
              className="button ghost"
              disabled={isUploading}
              onClick={() => {
                setQueuedAttachments([]);
                setError(null);
                setSuccessMessage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              type="button"
            >
              Svuota coda
            </button>
          ) : null}
        </div>
      </form>

      <p className="hint">
        Carica PDF, immagini e file di lavorazione senza lasciare la scheda ordine. I file salgono uno dopo l'altro
        per evitare blocchi.
      </p>
      {successMessage ? <div className="mini-item">{successMessage}</div> : null}
      {error ? <div className="empty">{error}</div> : null}
    </div>
  );
}
