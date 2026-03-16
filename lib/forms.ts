import { InvoiceStatus, MainPhase, OperationalStatus, PaymentMethod, Priority } from "@prisma/client";
import { normalizeOrderTitle, OrderItemInput } from "@/lib/orders";

export function parseCurrencyToCents(raw: string | null) {
  const value = (raw || "").trim().replace(/\./g, "").replace(",", ".");
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Importo non valido.");
  }

  return Math.round(parsed * 100);
}

export function parseDateTime(raw: string | null) {
  if (!raw) {
    throw new Error("Data consegna obbligatoria.");
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data consegna non valida.");
  }

  return date;
}

export function parsePriority(raw: string | null): Priority {
  const value = raw as Priority | null;
  if (!value || !["BASSA", "MEDIA", "ALTA", "URGENTE"].includes(value)) {
    return "MEDIA";
  }

  return value;
}

export function parseInvoiceStatus(raw: string | null): InvoiceStatus {
  const value = raw as InvoiceStatus | null;
  if (!value || !["DA_FATTURARE", "FATTURATO", "NON_RICHIESTO"].includes(value)) {
    return "DA_FATTURARE";
  }

  return value;
}

export function parseOperationalStatus(raw: string | null): OperationalStatus {
  const value = raw as OperationalStatus | null;
  if (!value || !["ATTIVO", "IN_ATTESA_FILE", "IN_ATTESA_APPROVAZIONE"].includes(value)) {
    return "ATTIVO";
  }

  return value;
}

export function parsePaymentMethod(raw: string | null): PaymentMethod {
  const value = raw as PaymentMethod | null;
  if (!value || !["CONTANTI", "CARTA", "BONIFICO", "ALTRO"].includes(value)) {
    return "CONTANTI";
  }

  return value;
}

export function parseMainPhase(raw: string | null): MainPhase {
  const value = raw as MainPhase | null;
  if (!value || !["ACCETTATO", "CALENDARIZZATO", "IN_LAVORAZIONE", "SVILUPPO_COMPLETATO", "CONSEGNATO"].includes(value)) {
    throw new Error("Fase ordine non valida.");
  }

  return value;
}

export function parseItemsPayload(raw: string | null): OrderItemInput[] {
  if (!raw) {
    return [];
  }

  const payload = JSON.parse(raw) as Array<Record<string, unknown>>;
  return payload.map((entry) => ({
    label: normalizeOrderTitle(String(entry.label ?? "")),
    description: String(entry.description ?? ""),
    quantity: Number(entry.quantity ?? 1),
    unitPriceCents: Math.max(0, Number(entry.unitPriceCents ?? 0)),
    format: String(entry.format ?? ""),
    material: String(entry.material ?? ""),
    finishing: String(entry.finishing ?? ""),
    notes: String(entry.notes ?? ""),
    serviceCatalogId: entry.serviceCatalogId ? String(entry.serviceCatalogId) : undefined
  }));
}
