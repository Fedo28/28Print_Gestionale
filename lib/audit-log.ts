import { AuditActionType, AuditEntityType, CustomerType, PurchaseNoteUrgency } from "@prisma/client";
import { formatDateKey } from "@/lib/format";
import { getOrderRecentActivityFeed } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  actionType: AuditActionType;
  title: string;
  details?: string | null;
  actorUserId?: string | null;
  snapshotBefore?: unknown;
  snapshotAfter?: unknown;
};

export type ProjectRecentActivityEntry = {
  id: string;
  source: "audit" | "order";
  categoryLabel: string;
  entityLabel: string;
  summary: string;
  details: string | null;
  href: string;
  createdAt: Date;
  actorLabel: string | null;
  canRestore: boolean;
  restoreOrderId?: string;
  restoreHistoryId?: string;
};

export type AuditTrailEntry = {
  id: string;
  categoryLabel: string;
  title: string;
  details: string | null;
  createdAt: Date;
  actorLabel: string | null;
  actionType: AuditActionType;
};

export type DeletedEntityEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  categoryLabel: string;
  entityLabel: string;
  summary: string;
  details: string | null;
  href: string;
  createdAt: Date;
  actorLabel: string | null;
  canRestore: boolean;
  restoreLabel: string | null;
  statusNote: string | null;
};

export type RestoreDeletedEntityResult = {
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  href: string;
  relatedOrderId?: string | null;
  snapshotAfter?: unknown;
};

type ParsedCustomerAuditSnapshot = {
  id: string;
  name: string;
  type: CustomerType;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  pec: string | null;
  taxCode: string | null;
  vatNumber: string | null;
  uniqueCode: string | null;
  notes: string | null;
  createdAt: Date | null;
};

type ParsedPurchaseNoteAuditSnapshot = {
  id: string;
  customerId: string | null;
  customerName: string;
  orderId: string | null;
  content: string;
  urgency: PurchaseNoteUrgency;
  createdAt: Date | null;
  completedAt: Date | null;
};

function normalizeAuditSnapshot(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readDate(value: unknown) {
  const rawValue = readString(value);
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCustomerAuditSnapshot(value: unknown): ParsedCustomerAuditSnapshot | null {
  const snapshot = asRecord(value);
  if (!snapshot) {
    return null;
  }

  const id = readString(snapshot.id);
  const name = readString(snapshot.name);
  const type = snapshot.type === "PUBBLICO" || snapshot.type === "AZIENDA" ? snapshot.type : null;

  if (!id || !name || !type) {
    return null;
  }

  return {
    id,
    name,
    type,
    phone: readNullableString(snapshot.phone),
    whatsapp: readNullableString(snapshot.whatsapp),
    email: readNullableString(snapshot.email),
    pec: readNullableString(snapshot.pec),
    taxCode: readNullableString(snapshot.taxCode),
    vatNumber: readNullableString(snapshot.vatNumber),
    uniqueCode: readNullableString(snapshot.uniqueCode),
    notes: readNullableString(snapshot.notes),
    createdAt: readDate(snapshot.createdAt)
  };
}

function parsePurchaseNoteAuditSnapshot(value: unknown): ParsedPurchaseNoteAuditSnapshot | null {
  const snapshot = asRecord(value);
  if (!snapshot) {
    return null;
  }

  const id = readString(snapshot.id);
  const customerName = readString(snapshot.customerName);
  const content = readString(snapshot.content);
  const urgency =
    snapshot.urgency === "NORMALE" || snapshot.urgency === "URGENTE" || snapshot.urgency === "BLOCCANTE"
      ? snapshot.urgency
      : null;
  const order = asRecord(snapshot.order);

  if (!id || !customerName || !content || !urgency) {
    return null;
  }

  return {
    id,
    customerId: readNullableString(snapshot.customerId),
    customerName,
    orderId: order ? readNullableString(order.id) : null,
    content,
    urgency,
    createdAt: readDate(snapshot.createdAt),
    completedAt: readDate(snapshot.completedAt)
  };
}

export async function writeAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      actionType: input.actionType,
      title: input.title,
      details: input.details || undefined,
      actorUserId: input.actorUserId || undefined,
      snapshotBefore: normalizeAuditSnapshot(input.snapshotBefore),
      snapshotAfter: normalizeAuditSnapshot(input.snapshotAfter)
    }
  });
}

function getAuditCategoryLabel(entityType: AuditEntityType) {
  switch (entityType) {
    case "ORDER":
      return "Ordine";
    case "CUSTOMER":
      return "Cliente";
    case "PURCHASE_NOTE":
      return "Da ordinare";
    case "BILLBOARD_BOOKING":
      return "Cartelloni";
    case "SERVICE_CATALOG":
      return "Catalogo";
    case "STAFF_USER":
      return "Staff";
    default:
      return "Impostazioni";
  }
}

function getAuditActorLabel(actor: { name: string; nickname: string } | null) {
  if (!actor) {
    return null;
  }

  return `${actor.name} (@${actor.nickname})`;
}

function getAuditDateParam(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateKey(parsed);
}

function getAuditHref(entry: {
  entityType: AuditEntityType;
  entityId: string;
  actionType: AuditActionType;
  snapshotBefore: unknown;
  snapshotAfter: unknown;
}) {
  if (entry.entityType === "CUSTOMER") {
    return entry.actionType === "DELETED" ? "/customers" : `/customers/${entry.entityId}`;
  }

  if (entry.entityType === "PURCHASE_NOTE") {
    return "/purchase-notes";
  }

  if (entry.entityType === "BILLBOARD_BOOKING") {
    const snapshotSource =
      (entry.snapshotAfter && typeof entry.snapshotAfter === "object" && !Array.isArray(entry.snapshotAfter)
        ? (entry.snapshotAfter as { startsAt?: unknown })
        : null) ||
      (entry.snapshotBefore && typeof entry.snapshotBefore === "object" && !Array.isArray(entry.snapshotBefore)
        ? (entry.snapshotBefore as { startsAt?: unknown })
        : null);
    const dateParam = getAuditDateParam(snapshotSource?.startsAt);

    return dateParam ? `/billboards?date=${dateParam}` : "/billboards";
  }

  if (entry.entityType === "SERVICE_CATALOG") {
    return "/settings";
  }

  if (entry.entityType === "STAFF_USER") {
    return "/settings/staff";
  }

  if (entry.entityType === "ORDER") {
    const snapshotSource =
      (entry.snapshotBefore && typeof entry.snapshotBefore === "object" && !Array.isArray(entry.snapshotBefore)
        ? (entry.snapshotBefore as { isQuote?: unknown })
        : null) ||
      (entry.snapshotAfter && typeof entry.snapshotAfter === "object" && !Array.isArray(entry.snapshotAfter)
        ? (entry.snapshotAfter as { isQuote?: unknown })
        : null);

    return snapshotSource?.isQuote ? "/quotes" : "/orders";
  }

  return entry.entityId === "staffInviteSettings" ? "/settings/staff" : "/settings";
}

function getDeletedEntityStatusNote(entityType: AuditEntityType) {
  switch (entityType) {
    case "ORDER":
      return "Ordini e preventivi eliminati restano tracciati, ma il ripristino automatico richiede una ricostruzione piu completa.";
    default:
      return null;
  }
}

function canRestoreDeletedEntity(entityType: AuditEntityType, snapshotBefore: unknown) {
  if (entityType === "CUSTOMER") {
    return Boolean(parseCustomerAuditSnapshot(snapshotBefore));
  }

  if (entityType === "PURCHASE_NOTE") {
    return Boolean(parsePurchaseNoteAuditSnapshot(snapshotBefore));
  }

  return false;
}

async function getRecentAuditActivity(limit: number) {
  const logs = await prisma.auditLog.findMany({
    include: {
      actorUser: {
        select: {
          name: true,
          nickname: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return logs.map((entry) => ({
    id: `audit:${entry.id}`,
    source: "audit" as const,
    categoryLabel: getAuditCategoryLabel(entry.entityType),
    entityLabel: entry.entityLabel,
    summary: entry.title,
    details: entry.details || null,
    href: getAuditHref(entry),
    createdAt: entry.createdAt,
    actorLabel: getAuditActorLabel(entry.actorUser),
    canRestore: false
  }));
}

export async function getEntityAuditTrail(
  entityType: AuditEntityType,
  entityId: string,
  options?: { limit?: number }
) {
  const limit = Math.max(1, options?.limit || 8);
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType,
      entityId
    },
    include: {
      actorUser: {
        select: {
          name: true,
          nickname: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return logs.map((entry) => ({
    id: entry.id,
    categoryLabel: getAuditCategoryLabel(entry.entityType),
    title: entry.title,
    details: entry.details || null,
    createdAt: entry.createdAt,
    actorLabel: getAuditActorLabel(entry.actorUser),
    actionType: entry.actionType
  })) satisfies AuditTrailEntry[];
}

export async function getDeletedEntityFeed(options?: { limit?: number }) {
  const limit = Math.max(6, options?.limit || 20);
  const logs = await prisma.auditLog.findMany({
    where: {
      actionType: "DELETED"
    },
    include: {
      actorUser: {
        select: {
          name: true,
          nickname: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return logs.map((entry) => ({
    id: entry.id,
    entityType: entry.entityType,
    entityId: entry.entityId,
    categoryLabel: getAuditCategoryLabel(entry.entityType),
    entityLabel: entry.entityLabel,
    summary: entry.title,
    details: entry.details || null,
    href: getAuditHref(entry),
    createdAt: entry.createdAt,
    actorLabel: getAuditActorLabel(entry.actorUser),
    canRestore: canRestoreDeletedEntity(entry.entityType, entry.snapshotBefore),
    restoreLabel:
      entry.entityType === "CUSTOMER"
        ? "Ripristina cliente"
        : entry.entityType === "PURCHASE_NOTE"
          ? "Ripristina nota"
          : null,
    statusNote: getDeletedEntityStatusNote(entry.entityType)
  })) satisfies DeletedEntityEntry[];
}

export async function restoreDeletedEntity(auditLogId: string): Promise<RestoreDeletedEntityResult> {
  const entry = await prisma.auditLog.findUnique({
    where: { id: auditLogId }
  });

  if (!entry || entry.actionType !== "DELETED") {
    throw new Error("Voce cestino non trovata.");
  }

  if (entry.entityType === "CUSTOMER") {
    const snapshot = parseCustomerAuditSnapshot(entry.snapshotBefore);
    if (!snapshot) {
      throw new Error("Snapshot cliente non valido.");
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: snapshot.id },
      select: { id: true }
    });

    if (existingCustomer) {
      throw new Error("Questo cliente e gia stato ripristinato.");
    }

    const restoredCustomer = await prisma.customer.create({
      data: {
        id: snapshot.id,
        name: snapshot.name,
        type: snapshot.type,
        phone: snapshot.phone || undefined,
        whatsapp: snapshot.whatsapp || undefined,
        email: snapshot.email || undefined,
        pec: snapshot.pec || undefined,
        taxCode: snapshot.taxCode || undefined,
        vatNumber: snapshot.vatNumber || undefined,
        uniqueCode: snapshot.uniqueCode || undefined,
        notes: snapshot.notes || undefined,
        createdAt: snapshot.createdAt || undefined
      }
    });

    return {
      entityType: "CUSTOMER",
      entityId: restoredCustomer.id,
      entityLabel: restoredCustomer.name,
      href: `/customers/${restoredCustomer.id}`,
      snapshotAfter: normalizeAuditSnapshot({
        id: restoredCustomer.id,
        name: restoredCustomer.name,
        type: restoredCustomer.type,
        phone: restoredCustomer.phone || null,
        whatsapp: restoredCustomer.whatsapp || null,
        email: restoredCustomer.email || null,
        pec: restoredCustomer.pec || null,
        taxCode: restoredCustomer.taxCode || null,
        vatNumber: restoredCustomer.vatNumber || null,
        uniqueCode: restoredCustomer.uniqueCode || null,
        notes: restoredCustomer.notes || null,
        createdAt: restoredCustomer.createdAt,
        updatedAt: restoredCustomer.updatedAt
      })
    };
  }

  if (entry.entityType === "PURCHASE_NOTE") {
    const snapshot = parsePurchaseNoteAuditSnapshot(entry.snapshotBefore);
    if (!snapshot) {
      throw new Error("Snapshot nota non valido.");
    }

    const existingNote = await prisma.purchaseNote.findUnique({
      where: { id: snapshot.id },
      select: { id: true }
    });

    if (existingNote) {
      throw new Error("Questa nota e gia stata ripristinata.");
    }

    let nextOrderId = snapshot.orderId;
    let nextCustomerId = snapshot.customerId;
    let nextCustomerName = snapshot.customerName;

    if (nextOrderId) {
      const linkedOrder = await prisma.order.findUnique({
        where: { id: nextOrderId },
        select: {
          id: true,
          customer: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (linkedOrder) {
        nextOrderId = linkedOrder.id;
        nextCustomerId = linkedOrder.customer.id;
        nextCustomerName = linkedOrder.customer.name;
      } else {
        nextOrderId = null;
      }
    }

    if (!nextOrderId && nextCustomerId) {
      const linkedCustomer = await prisma.customer.findUnique({
        where: { id: nextCustomerId },
        select: { id: true, name: true }
      });

      if (linkedCustomer) {
        nextCustomerId = linkedCustomer.id;
        nextCustomerName = linkedCustomer.name;
      } else {
        nextCustomerId = null;
      }
    }

    const restoredNote = await prisma.purchaseNote.create({
      data: {
        id: snapshot.id,
        customerId: nextCustomerId,
        orderId: nextOrderId,
        customerName: nextCustomerName,
        content: snapshot.content,
        urgency: snapshot.urgency,
        completedAt: snapshot.completedAt || undefined,
        createdAt: snapshot.createdAt || undefined
      },
      select: {
        id: true,
        customerId: true,
        customerName: true,
        content: true,
        urgency: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        order: {
          select: {
            id: true,
            orderCode: true,
            title: true,
            operationalStatus: true
          }
        }
      }
    });

    return {
      entityType: "PURCHASE_NOTE",
      entityId: restoredNote.id,
      entityLabel: restoredNote.customerName,
      href: restoredNote.order ? `/orders/${restoredNote.order.id}` : "/purchase-notes",
      relatedOrderId: restoredNote.order?.id || null,
      snapshotAfter: normalizeAuditSnapshot({
        id: restoredNote.id,
        customerId: restoredNote.customerId,
        customerName: restoredNote.customerName,
        content: restoredNote.content,
        urgency: restoredNote.urgency,
        createdAt: restoredNote.createdAt,
        updatedAt: restoredNote.updatedAt,
        completedAt: restoredNote.completedAt,
        order: restoredNote.order
          ? {
              id: restoredNote.order.id,
              orderCode: restoredNote.order.orderCode,
              title: restoredNote.order.title,
              operationalStatus: restoredNote.order.operationalStatus
            }
          : null
      })
    };
  }

  throw new Error("Questa voce puo essere consultata ma non ripristinata automaticamente.");
}

export async function getRecentProjectActivityFeed(options?: { limit?: number }) {
  const limit = Math.max(4, options?.limit || 10);
  const [auditEntries, orderActivity] = await Promise.all([
    getRecentAuditActivity(limit * 2),
    getOrderRecentActivityFeed({ limit, invoiceLimit: Math.min(limit, 6) })
  ]);

  const orderEntries = [...orderActivity.recentInvoiceChanges, ...orderActivity.recentChanges].map((entry) => ({
    id: `order:${entry.id}`,
    source: "order" as const,
    categoryLabel: entry.categoryLabel,
    entityLabel: entry.orderLabel,
    summary: entry.summary,
    details:
      entry.description !== entry.summary
        ? `${entry.description} • ${entry.customerName}${entry.customerContact ? ` • ${entry.customerContact}` : ""}`
        : `${entry.customerName}${entry.customerContact ? ` • ${entry.customerContact}` : ""}`,
    href: `${entry.href}#order-history-panel`,
    createdAt: entry.createdAt,
    actorLabel: null,
    canRestore: entry.canRestore,
    restoreOrderId: entry.orderId,
    restoreHistoryId: entry.id
  }));

  return [...auditEntries, ...orderEntries]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);
}
