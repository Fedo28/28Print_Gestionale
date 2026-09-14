"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { formatAttachmentMaxSize, formatAttachmentSize } from "@/lib/attachment-utils";
import type { SalesOrderBillingPartyKind } from "@/lib/domain/commerce/shop-foundation";
import {
  SHOP_FILE_ALLOWED_EXTENSIONS,
  SHOP_FILE_MAX_SIZE_BYTES,
  validateShopFileCandidate
} from "@/lib/domain/files/shop-file-assets";
import { quoteCatalogService } from "@/lib/domain/pricing/service-pricing";
import { formatCurrency } from "@/lib/format";
import { estimatePdfPageCount } from "@/lib/pdf-page-count";
import {
  buildShopDocumentCardSummary,
  buildShopDocumentBundleDetailedSummary,
  buildShopDocumentBundleOverview,
  buildShopDocumentOptionsSummary,
  formatShopDocumentPagesLabel,
  getShopPrintOptionGroups,
  normalizeShopDocument,
  normalizeShopDocumentBundle,
  resolveShopDocumentPreviewPricing,
  type ShopDocumentConfiguration,
  type ShopPrintConfiguration
} from "@/lib/shop-print-config";
import type { ShopPublishedService } from "@/lib/shop-catalog";

type ShopDocumentConfiguratorProps = {
  customerSignedIn: boolean;
  displayName: string;
  initialQuantity: number;
  service: ShopPublishedService;
  sourcePath: string;
};

type SelectedShopDocument = ShopDocumentConfiguration & {
  file: File;
  uploadError: string | null;
  uploadStatus: "ready" | "uploading" | "error";
};

type CreateShopOrderResponse = {
  orderId: string;
  redirectPath: string;
  salesOrderItemId: string | null;
  success: true;
};

type ShopBillingDetailsDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  companyName: string;
  country: string;
  fullName: string;
  kind: SalesOrderBillingPartyKind;
  pec: string;
  phone: string;
  postalCode: string;
  province: string;
  sdiCode: string;
  taxCode: string;
  vatNumber: string;
};

const billingKindOptions: Array<{
  description: string;
  label: string;
  value: SalesOrderBillingPartyKind;
}> = [
  {
    value: "PRIVATE",
    label: "Privato",
    description: "Nome e cognome"
  },
  {
    value: "PROFESSIONAL",
    label: "Professionista",
    description: "Persona fisica con P. IVA"
  },
  {
    value: "BUSINESS",
    label: "Azienda",
    description: "Ragione sociale"
  }
];

const defaultBillingDetailsDraft: ShopBillingDetailsDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  companyName: "",
  country: "Italia",
  fullName: "",
  kind: "PRIVATE",
  pec: "",
  phone: "",
  postalCode: "",
  province: "",
  sdiCode: "",
  taxCode: "",
  vatNumber: ""
};

function SettingsGlyph() {
  return (
    <svg aria-hidden="true" className="shop-action-glyph" fill="none" viewBox="0 0 24 24">
      <path
        d="M10.4 3.4h3.2l.5 2.1a6.92 6.92 0 0 1 1.7.7l1.9-1.1 2.3 2.3-1.1 1.9c.3.5.5 1.1.7 1.7l2.1.5v3.2l-2.1.5a6.92 6.92 0 0 1-.7 1.7l1.1 1.9-2.3 2.3-1.9-1.1c-.5.3-1.1.5-1.7.7l-.5 2.1h-3.2l-.5-2.1a6.92 6.92 0 0 1-1.7-.7l-1.9 1.1-2.3-2.3 1.1-1.9a6.92 6.92 0 0 1-.7-1.7l-2.1-.5v-3.2l2.1-.5c.1-.6.4-1.2.7-1.7L4.7 7.4 7 5.1l1.9 1.1c.5-.3 1.1-.5 1.7-.7l.5-2.1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function buildSelectedDocumentId(file: File, serial: number) {
  return `document-${serial}-${file.size}-${file.lastModified}`;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function resolveSelectedDocumentPageCount(file: File) {
  if (!isPdfFile(file)) {
    return 1;
  }

  try {
    return estimatePdfPageCount(await file.arrayBuffer());
  } catch {
    return 1;
  }
}

function normalizeSelectedShopDocument(
  input: Partial<ShopDocumentConfiguration> & {
    file: File;
    uploadError?: string | null;
    uploadStatus?: SelectedShopDocument["uploadStatus"];
  },
  index = 0
): SelectedShopDocument {
  const { file, uploadError, uploadStatus, ...document } = input;

  return {
    ...normalizeShopDocument(document, index),
    file,
    uploadError: uploadError || null,
    uploadStatus: uploadStatus || "ready"
  };
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function createShopOrder(payload: {
  billingDetails?: ShopBillingDetailsDraft | null;
  configurationSummary: string;
  customerNote: string;
  documentBundle: { documents: ShopDocumentConfiguration[] };
  invoiceRequested: boolean;
  quantity: number;
  serviceId: string;
  serviceLabel: string;
  sourcePath: string;
}) {
  const response = await fetch("/api/shop/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Ordine shop non creato.");
  }

  return (await response.json()) as CreateShopOrderResponse;
}

async function uploadShopDocumentFile(orderId: string, salesOrderItemId: string | null, file: File) {
  const formData = new FormData();
  if (salesOrderItemId) {
    formData.set("salesOrderItemId", salesOrderItemId);
  }
  formData.set("file", file);

  const response = await fetch(`/api/shop/orders/${orderId}/files`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Upload file shop non riuscito.");
  }
}

function normalizeBillingText(value: string) {
  return value.trim();
}

function normalizeBillingDetailsDraft(draft: ShopBillingDetailsDraft): ShopBillingDetailsDraft {
  return {
    ...draft,
    addressLine1: normalizeBillingText(draft.addressLine1),
    addressLine2: normalizeBillingText(draft.addressLine2),
    city: normalizeBillingText(draft.city),
    companyName: normalizeBillingText(draft.companyName),
    country: normalizeBillingText(draft.country) || "Italia",
    fullName: normalizeBillingText(draft.fullName),
    pec: normalizeBillingText(draft.pec).toLowerCase(),
    phone: normalizeBillingText(draft.phone),
    postalCode: normalizeBillingText(draft.postalCode).toUpperCase(),
    province: normalizeBillingText(draft.province).toUpperCase(),
    sdiCode: normalizeBillingText(draft.sdiCode).toUpperCase(),
    taxCode: normalizeBillingText(draft.taxCode).toUpperCase(),
    vatNumber: normalizeBillingText(draft.vatNumber).toUpperCase()
  };
}

function getBillingDetailsValidationMessage(draft: ShopBillingDetailsDraft) {
  const normalized = normalizeBillingDetailsDraft(draft);
  const missingFields: string[] = [];

  if (normalized.kind === "BUSINESS") {
    if (!normalized.companyName) {
      missingFields.push("ragione sociale");
    }
    if (!normalized.vatNumber) {
      missingFields.push("P. IVA");
    }
  } else {
    if (!normalized.fullName) {
      missingFields.push("nome e cognome");
    }
    if (normalized.kind === "PRIVATE" && !normalized.taxCode) {
      missingFields.push("codice fiscale");
    }
    if (normalized.kind === "PROFESSIONAL" && !normalized.taxCode && !normalized.vatNumber) {
      missingFields.push("codice fiscale o P. IVA");
    }
  }

  if (!normalized.addressLine1) {
    missingFields.push("indirizzo");
  }
  if (!normalized.postalCode) {
    missingFields.push("CAP");
  }
  if (!normalized.city) {
    missingFields.push("citta");
  }
  if (!normalized.province) {
    missingFields.push("provincia");
  }

  return missingFields.length
    ? `Per richiedere la fattura completa: ${missingFields.join(", ")}.`
    : null;
}

export function ShopDocumentConfigurator({
  customerSignedIn,
  displayName,
  initialQuantity,
  service,
  sourcePath
}: ShopDocumentConfiguratorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextDocumentIdRef = useRef(1);
  const [documents, setDocuments] = useState<SelectedShopDocument[]>([]);
  const [customerNote, setCustomerNote] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [billingDetails, setBillingDetails] = useState<ShopBillingDetailsDraft>(
    defaultBillingDetailsDraft
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdOrderPath, setCreatedOrderPath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);

  const normalizedBundle = documents.length ? normalizeShopDocumentBundle({ documents }) : null;
  const pricedService = resolveShopDocumentPreviewPricing(service, sourcePath);
  const quote = normalizedBundle
    ? quoteCatalogService({
        service: pricedService,
        quantity: normalizedBundle.totalPrintUnits
      })
    : null;
  const orderOverview = normalizedBundle ? buildShopDocumentBundleOverview(normalizedBundle) : "Nessun documento inserito";
  const documentSummary = normalizedBundle ? buildShopDocumentBundleDetailedSummary(normalizedBundle) : "";
  const billingValidationMessage = invoiceRequested
    ? getBillingDetailsValidationMessage(billingDetails)
    : null;
  const billingHeadingLabel =
    billingDetails.kind === "BUSINESS" ? "Ragione sociale" : "Nome e cognome";

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function appendFiles(fileList: FileList | File[]) {
    const nextEntries: SelectedShopDocument[] = [];
    const nextErrors: string[] = [];
    let nextSerial = nextDocumentIdRef.current;
    const files = Array.from(fileList);

    for (const [index, file] of files.entries()) {
      const validation = validateShopFileCandidate({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size
      });

      if (!validation.valid) {
        nextErrors.push(`${file.name}: ${validation.errors[0]}`);
        continue;
      }

      const pages = await resolveSelectedDocumentPageCount(file);

      nextEntries.push(
        normalizeSelectedShopDocument(
          {
            copies: Math.max(1, Math.round(initialQuantity || 1)),
            file,
            id: buildSelectedDocumentId(file, nextSerial++),
            name: validation.normalizedFileName,
            pages
          },
          documents.length + index
        )
      );
    }

    if (nextEntries.length) {
      nextDocumentIdRef.current = nextSerial;
      setDocuments((current) => current.concat(nextEntries));
      setExpandedDocumentId(null);
      setSuccessMessage(null);
      setCreatedOrderPath(null);
    }

    setError(nextErrors.length ? nextErrors.join(" • ") : null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeDocument(documentId: string) {
    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setExpandedDocumentId((current) => (current === documentId ? null : current));
    setError(null);
    setSuccessMessage(null);
  }

  function updateDocumentCopies(documentId: string, value: number) {
    setDocuments((current) =>
      current.map((document, index) =>
        document.id === documentId
          ? normalizeSelectedShopDocument(
              {
                ...document,
                copies: value
              },
              index
            )
          : document
      )
    );
  }

  function updateDocumentOption<TKey extends keyof ShopPrintConfiguration>(
    documentId: string,
    key: TKey,
    value: ShopPrintConfiguration[TKey]
  ) {
    setDocuments((current) =>
      current.map((document, index) =>
        document.id === documentId
          ? normalizeSelectedShopDocument(
              {
                ...document,
                [key]: value
              },
              index
            )
          : document
      )
    );
  }

  async function handleCreateOrder() {
    if (!normalizedBundle || !documents.length) {
      setError("Inserisci almeno un documento prima di continuare.");
      return;
    }

    const normalizedBillingDetails = invoiceRequested
      ? normalizeBillingDetailsDraft(billingDetails)
      : null;

    if (invoiceRequested && billingValidationMessage) {
      setError(billingValidationMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setCreatedOrderPath(null);
    setDocuments((current) => current.map((document) => ({ ...document, uploadError: null, uploadStatus: "ready" })));

    try {
      const createdOrder = await createShopOrder({
        billingDetails: normalizedBillingDetails,
        configurationSummary: documentSummary,
        customerNote,
        documentBundle: {
          documents: normalizedBundle.documents
        },
        invoiceRequested,
        quantity: normalizedBundle.totalPrintUnits,
        serviceId: service.id,
        serviceLabel: displayName,
        sourcePath
      });

      let failedUploads = 0;

      for (const document of documents) {
        setDocuments((current) =>
          current.map((entry) =>
            entry.id === document.id
              ? {
                  ...entry,
                  uploadError: null,
                  uploadStatus: "uploading"
                }
              : entry
          )
        );

        try {
          await uploadShopDocumentFile(createdOrder.orderId, createdOrder.salesOrderItemId, document.file);
          setDocuments((current) =>
            current.map((entry) =>
              entry.id === document.id
                ? {
                    ...entry,
                    uploadError: null,
                    uploadStatus: "ready"
                  }
                : entry
            )
          );
        } catch (uploadError) {
          failedUploads += 1;
          const message = getRequestErrorMessage(uploadError, "Upload file shop non riuscito.");
          setDocuments((current) =>
            current.map((entry) =>
              entry.id === document.id
                ? {
                    ...entry,
                    uploadError: message,
                    uploadStatus: "error"
                  }
                : entry
            )
          );
          continue;
        }
      }

      if (failedUploads > 0) {
        setCreatedOrderPath(createdOrder.redirectPath);
        setError(
          failedUploads === 1
            ? "Ordine creato, ma 1 file non e stato caricato. Apri l'ordine e completa il caricamento."
            : `Ordine creato, ma ${failedUploads} file non sono stati caricati. Apri l'ordine e completa il caricamento.`
        );
        return;
      }

      setSuccessMessage("Ordine creato. Sto aprendo il riepilogo.");
      startTransition(() => {
        router.push(`${createdOrder.redirectPath}?checkout=1`);
      });
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, "Ordine shop non creato."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="shop-configurator-flow">
      <section className="shop-card shop-configurator-step-card">
        <div className="shop-configurator-step-head">
          <div>
            <h3>Inserisci i documenti</h3>
          </div>

          <button className="button primary" onClick={openFilePicker} type="button">
            {documents.length ? "Aggiungi altri documenti" : "Inserisci documenti"}
          </button>
        </div>

        <input
          accept={SHOP_FILE_ALLOWED_EXTENSIONS.join(",")}
          className="shop-document-file-input"
          multiple
          onChange={(event) => void appendFiles(event.currentTarget.files || [])}
          ref={fileInputRef}
          type="file"
        />

        <div className="shop-document-upload-hint">
          PDF o JPG, max {formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)} per file.
        </div>

        {documents.length ? (
          <div className="shop-document-stack">
            {documents.map((document, index) => (
              <article className="shop-document-card is-inline" key={document.id}>
                <div className="shop-document-card-head">
                  <div className="shop-document-title-block">
                    <span className="shop-document-index">Documento {index + 1}</span>
                    <strong title={document.name}>{document.name}</strong>
                    <div className="shop-document-file-meta subtle">
                      <span>{formatShopDocumentPagesLabel(document.pages)}</span>
                      <span>{formatAttachmentSize(document.file.size)}</span>
                    </div>
                  </div>

                  <div className="shop-document-card-actions">
                    {document.uploadStatus === "uploading" ? <span className="pill warning">Caricamento</span> : null}
                    {document.uploadStatus === "error" ? <span className="pill danger">Errore</span> : null}
                    <button
                      aria-controls={`shop-document-options-${document.id}`}
                      aria-expanded={expandedDocumentId === document.id}
                      className={`button shop-document-settings-button${expandedDocumentId === document.id ? " is-open" : ""}`}
                      onClick={() =>
                        setExpandedDocumentId((current) => (current === document.id ? null : document.id))
                      }
                      type="button"
                    >
                      <SettingsGlyph />
                      <span>{expandedDocumentId === document.id ? "Chiudi opzioni" : "Opzioni"}</span>
                    </button>
                    <button className="button ghost" onClick={() => removeDocument(document.id)} type="button">
                      Rimuovi
                    </button>
                  </div>
                </div>

                <div className="shop-document-summary-strip">
                  {buildShopDocumentOptionsSummary(document, { compact: true })}
                </div>

                {expandedDocumentId === document.id ? (
                  <div className="shop-document-options-panel" id={`shop-document-options-${document.id}`}>
                    <div className="shop-document-controls-grid">
                      <div className="shop-document-field shop-document-field-copies">
                        <span>Copie</span>
                        <div className="shop-quantity-panel is-compact is-inline">
                          <button
                            className="shop-quantity-button"
                            onClick={() => updateDocumentCopies(document.id, document.copies - 1)}
                            type="button"
                          >
                            -
                          </button>
                          <label className="shop-quantity-input" htmlFor={`shop-document-copies-${document.id}`}>
                            <span>Copie</span>
                            <input
                              id={`shop-document-copies-${document.id}`}
                              inputMode="numeric"
                              min="1"
                              onChange={(event) => updateDocumentCopies(document.id, Number(event.target.value))}
                              step="1"
                              type="number"
                              value={String(document.copies)}
                            />
                          </label>
                          <button
                            className="shop-quantity-button"
                            onClick={() => updateDocumentCopies(document.id, document.copies + 1)}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {getShopPrintOptionGroups(document).map((group) => (
                        <label
                          className="shop-document-field"
                          htmlFor={`shop-document-${group.key}-${document.id}`}
                          key={`${document.id}-${group.key}`}
                        >
                          <span>{group.label}</span>
                          <select
                            id={`shop-document-${group.key}-${document.id}`}
                            onChange={(event) =>
                              updateDocumentOption(document.id, group.key, event.target.value as ShopPrintConfiguration[typeof group.key])
                            }
                            value={document[group.key]}
                          >
                            {group.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {document.uploadError ? <div className="hint">{document.uploadError}</div> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="shop-document-empty-state">
            <strong>Nessun documento inserito</strong>
          </div>
        )}
      </section>

      <section className="shop-card shop-configurator-step-card">
        <div className="shop-configurator-step-head is-compact">
          <div>
            <h3>Totale</h3>
          </div>
        </div>

        <div className="shop-configurator-total-card">
          <strong>{quote ? formatCurrency(quote.lineTotalCents) : "--"}</strong>
          <div className="shop-summary-meta">{orderOverview}</div>
        </div>
      </section>

      <section className="shop-card shop-configurator-step-card">
        <div className="shop-configurator-step-head is-compact">
          <div>
            <h3>Note e fattura</h3>
          </div>
        </div>

        <div className="stack compact-stack">
          <div className="field full">
            <label className="toggle-field" htmlFor="shop-order-invoice-requested-inline">
              <input
                checked={invoiceRequested}
                id="shop-order-invoice-requested-inline"
                onChange={(event) => setInvoiceRequested(event.target.checked)}
                type="checkbox"
              />
              <span>Richiedo fattura</span>
            </label>
          </div>

          {invoiceRequested ? (
            <div className="shop-billing-panel">
              <div className="shop-billing-kind-row" aria-label="Tipo fatturazione" role="radiogroup">
                {billingKindOptions.map((option) => (
                  <button
                    aria-checked={billingDetails.kind === option.value}
                    className={`shop-billing-kind-button${billingDetails.kind === option.value ? " is-active" : ""}`}
                    key={option.value}
                    onClick={() =>
                      setBillingDetails((current) => ({
                        ...current,
                        kind: option.value
                      }))
                    }
                    role="radio"
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>

              <div className="shop-billing-grid">
                <div className="field full">
                  <label htmlFor="shop-order-billing-name">{billingHeadingLabel}</label>
                  <input
                    id="shop-order-billing-name"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        ...(current.kind === "BUSINESS"
                          ? { companyName: event.target.value }
                          : { fullName: event.target.value })
                      }))
                    }
                    value={billingDetails.kind === "BUSINESS" ? billingDetails.companyName : billingDetails.fullName}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-tax-code">Codice fiscale</label>
                  <input
                    id="shop-order-billing-tax-code"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        taxCode: event.target.value
                      }))
                    }
                    value={billingDetails.taxCode}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-vat-number">P. IVA</label>
                  <input
                    id="shop-order-billing-vat-number"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        vatNumber: event.target.value
                      }))
                    }
                    value={billingDetails.vatNumber}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-sdi-code">Codice univoco (CU)</label>
                  <input
                    id="shop-order-billing-sdi-code"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        sdiCode: event.target.value
                      }))
                    }
                    value={billingDetails.sdiCode}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-pec">PEC</label>
                  <input
                    id="shop-order-billing-pec"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        pec: event.target.value
                      }))
                    }
                    type="email"
                    value={billingDetails.pec}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-phone">Telefono</label>
                  <input
                    id="shop-order-billing-phone"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        phone: event.target.value
                      }))
                    }
                    value={billingDetails.phone}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="shop-order-billing-address-line-1">Indirizzo</label>
                  <input
                    id="shop-order-billing-address-line-1"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        addressLine1: event.target.value
                      }))
                    }
                    value={billingDetails.addressLine1}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="shop-order-billing-address-line-2">Interno, scala, c/o (facoltativo)</label>
                  <input
                    id="shop-order-billing-address-line-2"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        addressLine2: event.target.value
                      }))
                    }
                    value={billingDetails.addressLine2}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-postal-code">CAP</label>
                  <input
                    id="shop-order-billing-postal-code"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        postalCode: event.target.value
                      }))
                    }
                    value={billingDetails.postalCode}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-city">Citta</label>
                  <input
                    id="shop-order-billing-city"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        city: event.target.value
                      }))
                    }
                    value={billingDetails.city}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-province">Provincia</label>
                  <input
                    id="shop-order-billing-province"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        province: event.target.value
                      }))
                    }
                    value={billingDetails.province}
                  />
                </div>

                <div className="field">
                  <label htmlFor="shop-order-billing-country">Paese</label>
                  <input
                    id="shop-order-billing-country"
                    onChange={(event) =>
                      setBillingDetails((current) => ({
                        ...current,
                        country: event.target.value
                      }))
                    }
                    value={billingDetails.country}
                  />
                </div>
              </div>

              {billingValidationMessage ? (
                <div className="hint shop-billing-inline-hint">{billingValidationMessage}</div>
              ) : null}
            </div>
          ) : null}

          <div className="field full">
            <label htmlFor="shop-order-note-inline">Note</label>
            <textarea
              id="shop-order-note-inline"
              onChange={(event) => setCustomerNote(event.target.value)}
              placeholder="Scrivi solo quello che davvero ci deve aiutare a non sbagliare."
              rows={4}
              value={customerNote}
            />
          </div>
        </div>
      </section>

      <section className="shop-card shop-configurator-step-card">
        {successMessage ? <div className="mini-item">{successMessage}</div> : null}
        {error ? <div className="empty">{error}</div> : null}

        {createdOrderPath ? (
          <div className="button-row">
            <Link className="button ghost" href={createdOrderPath}>
              Apri ordine creato
            </Link>
          </div>
        ) : null}

        {customerSignedIn ? (
          <div className="shop-order-cta-stack">
            <div className="shop-order-cta-head">
              <strong>{displayName}</strong>
              <div className="subtle">{orderOverview}</div>
            </div>

            <div className="shop-customer-default-note">
              In mancanza di preferenze specifiche, il/i documento/i verranno stampati in B/N, copia singola, solo fronte.
            </div>

            <div className="button-row">
              <button
                className="button primary"
                disabled={isSubmitting || !documents.length || Boolean(billingValidationMessage)}
                onClick={handleCreateOrder}
                type="button"
              >
                {isSubmitting ? "Creazione ordine in corso..." : "Conferma e passa al riepilogo"}
              </button>
            </div>
          </div>
        ) : (
          <div className="shop-auth-cta-stack">
            <strong>Accedi per continuare</strong>
            <Link className="button primary" href="/shop/account/login">
              Accedi
            </Link>
            <Link className="button ghost" href="/shop/account/register">
              Crea account
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
