import { AuditActionType, AuditEntityType } from "@prisma/client";
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

function normalizeAuditSnapshot(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
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
