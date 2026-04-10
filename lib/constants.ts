import {
  BillboardAssetKind,
  BillboardBookingStatus,
  CustomerType,
  InvoiceStatus,
  MainPhase,
  OperationalStatus,
  PaymentMethod,
  PaymentStatus,
  Priority,
  UserRole
} from "@prisma/client";

export type VisibleMainPhase = Exclude<MainPhase, "CALENDARIZZATO">;

export const APP_TIMEZONE = "Europe/Rome";
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Ciao {nome_cliente}, il tuo ordine {order_code} e pronto per il ritiro.";
export const DEFAULT_STAFF_INVITE_EMAIL_SUBJECT = "Accesso al gestionale staff";
export const DEFAULT_STAFF_INVITE_EMAIL_TEMPLATE = `Ciao {nome_staff},

il tuo profilo staff e pronto.

Nickname: {nickname}
Link di accesso: {access_url}

La password iniziale viene definita internamente in fase di profilazione.

A presto.`;

export const priorityLabels: Record<Priority, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente"
};

export const customerTypeLabels: Record<CustomerType, string> = {
  PUBBLICO: "Pubblico",
  AZIENDA: "Azienda"
};

export const appointmentNoteOptions = [
  "Installazione vetrina",
  "Sopralluogo",
  "Lavorazione esterna",
  "Appuntamento cliente",
  "Lavorazione programmata"
] as const;

export function getAppointmentNoteOptions(currentValue?: string | null) {
  const normalizedCurrentValue = currentValue?.trim() || "";
  const options = [...appointmentNoteOptions];

  if (normalizedCurrentValue && !options.includes(normalizedCurrentValue as (typeof appointmentNoteOptions)[number])) {
    return [normalizedCurrentValue, ...options];
  }

  return options;
}

export const billboardAssetKindLabels: Record<BillboardAssetKind, string> = {
  CARTELLONE: "Cartellone",
  MONITOR: "Monitor",
  VELA_ITINERANTE: "Vela itinerante"
};

export const billboardBookingStatusLabels: Record<BillboardBookingStatus, string> = {
  OPZIONATO: "Opzionato",
  CONFERMATO: "Confermato",
  SCADUTO: "Scaduto"
};

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  OPERATOR: "Operatore"
};

export const mainPhaseLabels: Record<MainPhase, string> = {
  ACCETTATO: "Da avviare",
  CALENDARIZZATO: "In lavorazione",
  IN_LAVORAZIONE: "In lavorazione",
  SVILUPPO_COMPLETATO: "Pronto",
  CONSEGNATO: "Consegnato"
};

export const operationalStatusLabels: Record<OperationalStatus, string> = {
  ATTIVO: "Operativo",
  IN_ATTESA_FILE: "In attesa file",
  IN_ATTESA_APPROVAZIONE: "In attesa approvazione"
};

export const quoteFilterLabels = {
  ALL: "Tutti",
  ORDER: "Solo ordini",
  QUOTE: "Solo preventivi"
} as const;

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  NON_PAGATO: "Non pagato",
  ACCONTO: "Acconto",
  PARZIALE: "Parziale",
  PAGATO: "Pagato"
};

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DA_FATTURARE: "Da fatturare",
  FATTURATO: "Fatturato",
  NON_RICHIESTO: "Non richiesto"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CONTANTI: "Contanti",
  CARTA: "Carta",
  BONIFICO: "Bonifico",
  ALTRO: "Altro"
};

export const phaseOrder: VisibleMainPhase[] = ["ACCETTATO", "IN_LAVORAZIONE", "SVILUPPO_COMPLETATO", "CONSEGNATO"];

export const visibleMainPhases: VisibleMainPhase[] = phaseOrder;

export function normalizeMainPhaseForWorkflow(phase: MainPhase): VisibleMainPhase {
  return phase === "CALENDARIZZATO" ? "IN_LAVORAZIONE" : phase;
}
