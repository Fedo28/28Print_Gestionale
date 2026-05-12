import type { OperationalStatus, PurchaseNoteUrgency } from "@prisma/client";

export type PurchaseNoteOrderSummary = {
  id: string;
  orderCode: string;
  title: string;
  operationalStatus: OperationalStatus;
};

export type PurchaseNoteView = {
  id: string;
  customerId: string | null;
  order: PurchaseNoteOrderSummary | null;
  customerName: string;
  content: string;
  urgency: PurchaseNoteUrgency;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function normalizePurchaseNoteCustomerName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePurchaseNoteContent(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function toTime(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

export function serializePurchaseNote<T extends {
  id: string;
  customerId: string | null;
  order?: {
    id: string;
    orderCode: string;
    title: string;
    operationalStatus: OperationalStatus;
  } | null;
  customerName: string;
  content: string;
  urgency: PurchaseNoteUrgency;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
}>(note: T): PurchaseNoteView {
  return {
    id: note.id,
    customerId: note.customerId,
    order: note.order
      ? {
          id: note.order.id,
          orderCode: note.order.orderCode,
          title: note.order.title,
          operationalStatus: note.order.operationalStatus
        }
      : null,
    customerName: note.customerName,
    content: note.content,
    urgency: note.urgency,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    completedAt: note.completedAt ? new Date(note.completedAt).toISOString() : null
  };
}

export function getPurchaseNoteUrgencyWeight(value: PurchaseNoteUrgency | null | undefined) {
  switch (value) {
    case "BLOCCANTE":
      return 3;
    case "URGENTE":
      return 2;
    default:
      return 1;
  }
}

export function sortPendingPurchaseNotes<T extends { createdAt: Date | string; urgency?: PurchaseNoteUrgency | null }>(notes: T[]) {
  return [...notes].sort((left, right) => {
    const byUrgency = getPurchaseNoteUrgencyWeight(right.urgency) - getPurchaseNoteUrgencyWeight(left.urgency);
    if (byUrgency !== 0) {
      return byUrgency;
    }

    return toTime(right.createdAt) - toTime(left.createdAt);
  });
}

export function sortCompletedPurchaseNotes<T extends {
  completedAt: Date | string | null;
  createdAt: Date | string;
  urgency?: PurchaseNoteUrgency | null;
}>(notes: T[]) {
  return [...notes].sort((left, right) => {
    const byCompletedAt = toTime(right.completedAt) - toTime(left.completedAt);
    if (byCompletedAt !== 0) {
      return byCompletedAt;
    }

    const byUrgency = getPurchaseNoteUrgencyWeight(right.urgency) - getPurchaseNoteUrgencyWeight(left.urgency);
    if (byUrgency !== 0) {
      return byUrgency;
    }

    return toTime(right.createdAt) - toTime(left.createdAt);
  });
}
