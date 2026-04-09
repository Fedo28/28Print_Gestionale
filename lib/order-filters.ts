import { InvoiceStatus, MainPhase, OperationalStatus, PaymentStatus, Priority } from "@prisma/client";
import { normalizeMainPhaseForWorkflow, visibleMainPhases } from "@/lib/constants";
import type { VisibleMainPhase } from "@/lib/constants";

export type QuoteFilter = "ALL" | "QUOTE" | "ORDER";
export type PhaseFilter = VisibleMainPhase | "ALL";
export type StatusFilter = OperationalStatus | "ALL";
export type PaymentFilter = PaymentStatus | "ALL";
export type InvoiceFilter = InvoiceStatus | "ALL";
export type PriorityFilter = Priority | "ALL";
export type DashboardPreset =
  | "ALL"
  | "TODAY"
  | "APPOINTMENTS_TODAY"
  | "OVERDUE"
  | "PRIORITY_TODAY"
  | "TO_START"
  | "WORKING"
  | "BLOCKED"
  | "READY"
  | "BALANCE";

export const dashboardPresetLabels: Record<Exclude<DashboardPreset, "ALL">, string> = {
  TODAY: "Consegne di oggi",
  APPOINTMENTS_TODAY: "Appuntamenti di oggi",
  OVERDUE: "Arretrati",
  PRIORITY_TODAY: "Priorita di oggi",
  TO_START: "Da avviare",
  WORKING: "In lavorazione",
  BLOCKED: "Sospesi",
  READY: "Pronti",
  BALANCE: "Saldi aperti"
};

export type OrderListFilters = {
  q?: string;
  phase?: PhaseFilter;
  status?: StatusFilter;
  payment?: PaymentFilter;
  invoice?: InvoiceFilter;
  priority?: PriorityFilter;
  quote?: QuoteFilter;
  preset?: DashboardPreset;
};

const mainPhases = visibleMainPhases as PhaseFilter[];
const operationalStatuses: OperationalStatus[] = ["ATTIVO", "IN_ATTESA_FILE", "IN_ATTESA_APPROVAZIONE"];
const paymentStatuses: PaymentStatus[] = ["NON_PAGATO", "ACCONTO", "PARZIALE", "PAGATO"];
const invoiceStatuses: InvoiceStatus[] = ["DA_FATTURARE", "FATTURATO", "NON_RICHIESTO"];
const priorities: Priority[] = ["BASSA", "MEDIA", "ALTA", "URGENTE"];

export function parsePhaseFilter(raw: string | null): PhaseFilter {
  if (!raw) {
    return "ALL";
  }

  const normalized = normalizeMainPhaseForWorkflow(raw as MainPhase) as PhaseFilter;
  return mainPhases.includes(normalized) ? normalized : "ALL";
}

export function parseStatusFilter(raw: string | null): StatusFilter {
  return raw && operationalStatuses.includes(raw as OperationalStatus) ? (raw as OperationalStatus) : "ALL";
}

export function parsePaymentFilter(raw: string | null): PaymentFilter {
  return raw && paymentStatuses.includes(raw as PaymentStatus) ? (raw as PaymentStatus) : "ALL";
}

export function parseInvoiceFilter(raw: string | null): InvoiceFilter {
  return raw && invoiceStatuses.includes(raw as InvoiceStatus) ? (raw as InvoiceStatus) : "ALL";
}

export function parsePriorityFilter(raw: string | null): PriorityFilter {
  return raw && priorities.includes(raw as Priority) ? (raw as Priority) : "ALL";
}

export function parseQuoteFilter(raw: string | null): QuoteFilter {
  if (raw === "QUOTE" || raw === "ORDER") {
    return raw;
  }

  return "ALL";
}

export function parseDashboardPreset(raw: string | null): DashboardPreset {
  if (
    raw &&
    [
      "TODAY",
      "APPOINTMENTS_TODAY",
      "OVERDUE",
      "PRIORITY_TODAY",
      "TO_START",
      "WORKING",
      "BLOCKED",
      "READY",
      "BALANCE"
    ].includes(raw)
  ) {
    return raw as DashboardPreset;
  }

  return "ALL";
}

export function buildOrdersFilterHref(filters: OrderListFilters) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.phase && filters.phase !== "ALL") {
    params.set("phase", normalizeMainPhaseForWorkflow(filters.phase));
  }

  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }

  if (filters.payment && filters.payment !== "ALL") {
    params.set("payment", filters.payment);
  }

  if (filters.invoice && filters.invoice !== "ALL") {
    params.set("invoice", filters.invoice);
  }

  if (filters.priority && filters.priority !== "ALL") {
    params.set("priority", filters.priority);
  }

  if (filters.quote && filters.quote !== "ALL") {
    params.set("quote", filters.quote);
  }

  if (filters.preset && filters.preset !== "ALL") {
    params.set("preset", filters.preset);
  }

  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}
