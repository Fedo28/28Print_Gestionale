"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatAttachmentMaxSize,
  formatAttachmentSize
} from "@/lib/attachment-utils";
import {
  SHOP_FILE_ALLOWED_EXTENSIONS,
  SHOP_FILE_MAX_SIZE_BYTES,
  validateShopFileCandidate
} from "@/lib/domain/files/shop-file-assets";

type QueuedShopFile = {
  id: string;
  file: File;
  error: string | null;
  status: "queued" | "uploading" | "done" | "error";
};

function buildQueuedShopFileId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Upload file shop non riuscito.";
}

async function uploadShopOrderFile(orderId: string, salesOrderItemId: string, file: File) {
  const formData = new FormData();
  formData.set("salesOrderItemId", salesOrderItemId);
  formData.set("file", file);

  const response = await fetch(`/api/shop/orders/${orderId}/files`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Upload file shop non riuscito.");
  }
}

export function ShopOrderFileUploadForm({
  orderId,
  salesOrderItemId
}: {
  orderId: string;
  salesOrderItemId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedShopFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  function appendFiles(fileList: FileList | File[]) {
    const nextEntries: QueuedShopFile[] = [];
    const nextErrors: string[] = [];

    Array.from(fileList).forEach((file, index) => {
      const validation = validateShopFileCandidate({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size
      });

      if (!validation.valid) {
        nextErrors.push(`${file.name}: ${validation.errors[0]}`);
        return;
      }

      nextEntries.push({
        id: buildQueuedShopFileId(file, index),
        file,
        error: null,
        status: "queued"
      });
    });

    if (nextEntries.length > 0) {
      setQueuedFiles((current) => {
        const knownIds = new Set(current.map((entry) => entry.id));
        return current.concat(nextEntries.filter((entry) => !knownIds.has(entry.id)));
      });
      setSuccessMessage(null);
    }

    setError(nextErrors.length ? nextErrors.join(" • ") : null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function uploadQueuedFiles() {
    const queue = queuedFiles.filter((entry) => entry.status === "queued" || entry.status === "error");
    if (!queue.length) {
      setError("Seleziona almeno un PDF o JPG prima di caricare i file.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    let successCount = 0;

    for (const entry of queue) {
      setQueuedFiles((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                error: null,
                status: "uploading"
              }
            : item
        )
      );

      try {
        await uploadShopOrderFile(orderId, salesOrderItemId, entry.file);
        successCount += 1;

        setQueuedFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  error: null,
                  status: "done"
                }
              : item
          )
        );
      } catch (uploadError) {
        const message = getUploadErrorMessage(uploadError);
        setQueuedFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  error: message,
                  status: "error"
                }
              : item
          )
        );
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      setSuccessMessage(successCount === 1 ? "File di stampa caricato." : `${successCount} file di stampa caricati.`);
      setQueuedFiles((current) => current.filter((entry) => entry.status !== "done"));
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
          await uploadQueuedFiles();
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
            accept={SHOP_FILE_ALLOWED_EXTENSIONS.join(",")}
            disabled={isUploading}
            multiple
            onChange={(event) => appendFiles(event.currentTarget.files || [])}
            ref={fileInputRef}
            type="file"
          />
          <strong>Carica file di stampa</strong>
          <div className="hint">PDF o JPG, max {formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}</div>
        </label>

        {queuedFiles.length ? (
          <div className="mini-list attachment-upload-queue">
            {queuedFiles.map((entry) => (
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
                          ? "Caricamento"
                          : entry.status === "done"
                            ? "Caricato"
                            : "Errore"}
                    </span>
                    {entry.status !== "uploading" ? (
                      <button
                        className="button ghost"
                        onClick={() => {
                          setQueuedFiles((current) => current.filter((item) => item.id !== entry.id));
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
          <button className="button primary" disabled={isUploading || queuedFiles.length === 0} type="submit">
            {isUploading
              ? "Caricamento in corso..."
              : queuedFiles.length > 1
                ? `Carica ${queuedFiles.length} file`
                : "Carica file"}
          </button>
          {queuedFiles.length ? (
            <button
              className="button ghost"
              disabled={isUploading}
              onClick={() => {
                setQueuedFiles([]);
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

      {successMessage ? <div className="mini-item">{successMessage}</div> : null}
      {error ? <div className="empty">{error}</div> : null}
    </div>
  );
}
