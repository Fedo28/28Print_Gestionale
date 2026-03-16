import {
  InvoiceStatus,
  MainPhase,
  OperationalStatus,
  PaymentMethod,
  PaymentStatus,
  Priority
} from "@prisma/client";

export const APP_TIMEZONE = "Europe/Rome";
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Ciao {nome_cliente}, il tuo ordine {order_code} e pronto per il ritiro.";

export const priorityLabels: Record<Priority, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente"
};

export const mainPhaseLabels: Record<MainPhase, string> = {
  ACCETTATO: "Accettato",
  CALENDARIZZATO: "Calendarizzato",
  IN_LAVORAZIONE: "In lavorazione",
  SVILUPPO_COMPLETATO: "Sviluppo completato",
  CONSEGNATO: "Consegnato"
};

export const operationalStatusLabels: Record<OperationalStatus, string> = {
  ATTIVO: "Attivo",
  IN_ATTESA_FILE: "In attesa file",
  IN_ATTESA_APPROVAZIONE: "In attesa approvazione"
};

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

export const phaseOrder: MainPhase[] = [
  "ACCETTATO",
  "CALENDARIZZATO",
  "IN_LAVORAZIONE",
  "SVILUPPO_COMPLETATO",
  "CONSEGNATO"
];
