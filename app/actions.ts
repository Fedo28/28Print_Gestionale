"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createBillboardBookings,
  deleteBillboardBooking,
  parseBillboardBookingDate,
  updateBillboardBooking
} from "@/lib/billboards";
import {
  parseCustomerType,
  parseBooleanFlag,
  parseCurrencyToCents,
  parseInvoiceRequestStatus,
  parseInvoiceStatus,
  parsePurchaseNoteUrgency,
  parseItemsPayload,
  parseMainPhase,
  parseOptionalDateTime,
  parseOperationalStatus,
  parsePaymentMethod,
  parseUserRole
} from "@/lib/forms";
import { restoreDeletedEntity, writeAuditLog } from "@/lib/audit-log";
import { formatDateKey } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import type { DiscountMode, MainPhase, OperationalStatus, Prisma } from "@prisma/client";
import {
  cloneOrderItem,
  correctPayment,
  createOrderItem,
  createOrder,
  createService,
  deleteOrderItem,
  deleteCustomer,
  deleteOrder,
  updateServiceCatalogEntry,
  markOrderReady,
  updateOrderInvoiceStatus,
  recordPayment,
  restoreOrderHistoryEntry,
  toggleOrderItemDelivery,
  transitionOrderPhase,
  updateCustomer,
  updateOrderItem,
  updateOrderQuoteFlag,
  updateOperationalStatus,
  updateOrder,
  saveOrderMaterialNote
} from "@/lib/orders";
import { authenticateUser, createSessionForUser, describeLoginFailure, requireAdmin, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestBaseUrl } from "@/lib/request-url";
import { saveSetting } from "@/lib/settings";
import { cleanupOrderAttachments } from "@/lib/storage";
import { buildOrderMaterialNoteContent, getOrderMaterialCategoryEntriesFromFormData } from "@/lib/order-material-note";
import {
  completePurchaseNote,
  createPurchaseNote,
  deletePurchaseNote,
  reopenPurchaseNote,
  updatePurchaseNote
} from "@/lib/purchase-notes";
import { serializePurchaseNote } from "@/lib/purchase-note-utils";
import {
  createStaffUser,
  getStaffInviteConfig,
  normalizeStaffAccessBaseUrl,
  sendStaffInviteEmail,
  updateOwnStaffNickname
} from "@/lib/staff-users";
import { parseServiceUnit } from "@/lib/service-units";
import { parseFlexibleAdjustmentInput } from "@/lib/pricing";
import { mainPhaseLabels, normalizeMainPhaseForWorkflow, operationalStatusLabels } from "@/lib/constants";
import { canTransitionPhase } from "@/lib/order-phase-transitions";

function revalidateOperationalSurfaces(orderId?: string) {
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/quotes");
  revalidatePath("/calendar");
  revalidatePath("/production");
  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}

function revalidateBillboardSurfaces() {
  revalidatePath("/billboards");
}

function revalidatePurchaseNoteSurfaces() {
  revalidatePath("/purchase-notes");
}

function revalidateLinkedPurchaseNoteSurfaces(orderId?: string | null) {
  revalidatePurchaseNoteSurfaces();
  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}

function parseOrderMaterialNoteInput(formData: FormData) {
  const content = String(formData.get("materialNoteContent") || "");
  const blockOrder = parseBooleanFlag(formData.get("materialNoteBlockOrder"));
  const categoryEntries = getOrderMaterialCategoryEntriesFromFormData(formData);
  const composedContent = buildOrderMaterialNoteContent({ content, categoryEntries });

  if (!composedContent && !blockOrder) {
    return null;
  }

  if (!composedContent) {
    throw new Error("Inserisci almeno una categoria o una nota prima di sospendere l'ordine.");
  }

  return {
    content: composedContent,
    urgency: parsePurchaseNoteUrgency(formData.get("materialNoteUrgency")?.toString() || null),
    blockOrder
  };
}

function parseOrderFormInput(formData: FormData, options?: { forceQuote?: boolean }) {
  const isQuote = options?.forceQuote ?? parseBooleanFlag(formData.get("isQuote"));
  const globalDiscount = parseFlexibleAdjustmentInput(formData.get("globalDiscount")?.toString() || null);
  const globalExtra = parseFlexibleAdjustmentInput(formData.get("globalExtra")?.toString() || null);
  const deliveryAt = parseOptionalDateTime(formData.get("deliveryAt")?.toString() || null);
  const appointmentAt = parseOptionalDateTime(formData.get("appointmentAt")?.toString() || null);

  if (!isQuote && !deliveryAt && !appointmentAt) {
    throw new Error("Per creare l'ordine devi impostare una consegna oppure un appuntamento.");
  }

  return {
    customerId: String(formData.get("customerId") || "").trim() || undefined,
    customer: {
      type: parseCustomerType(formData.get("customerType")?.toString() || null),
      name: String(formData.get("customerName") || ""),
      phone: String(formData.get("customerPhone") || ""),
      whatsapp: String(formData.get("customerWhatsapp") || ""),
      email: String(formData.get("customerEmail") || ""),
      pec: String(formData.get("customerPec") || ""),
      taxCode: String(formData.get("customerTaxCode") || ""),
      vatNumber: String(formData.get("customerVatNumber") || ""),
      uniqueCode: String(formData.get("customerUniqueCode") || ""),
      notes: String(formData.get("customerNotes") || "")
    },
    title: String(formData.get("title") || ""),
    deliveryAt,
    appointmentAt,
    appointmentNote: String(formData.get("appointmentNote") || ""),
    notes: String(formData.get("notes") || ""),
    invoiceStatus: parseInvoiceRequestStatus(formData.get("invoiceStatus")?.toString() || null),
    isQuote,
    items: parseItemsPayload(formData.get("itemsPayload")?.toString() || null),
    globalDiscountMode: globalDiscount.mode,
    globalDiscountValue: globalDiscount.value,
    globalExtraMode: globalExtra.mode,
    globalExtraValue: globalExtra.value,
    initialDepositCents: parseCurrencyToCents(formData.get("initialDeposit")?.toString() || null),
    materialNote: isQuote ? null : parseOrderMaterialNoteInput(formData)
  };
}

function parsePostSubmitAction(formData: FormData) {
  return String(formData.get("postSubmitAction") || "").trim() === "new" ? "new" : "detail";
}

function buildNextOrderEntryHref(options: {
  isQuote: boolean;
  customerId?: string | null;
  continuation: "created" | "updated";
}) {
  const basePath = options.isQuote ? "/quotes/new" : "/orders/new";
  const params = new URLSearchParams();

  if (options.customerId) {
    params.set("customerId", options.customerId);
  }

  params.set("continuation", options.continuation);

  return `${basePath}?${params.toString()}`;
}

const purchaseNoteAuditSelect = {
  id: true,
  customerId: true,
  customerName: true,
  order: {
    select: {
      id: true,
      orderCode: true,
      title: true,
      operationalStatus: true
    }
  },
  content: true,
  urgency: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true
} satisfies Prisma.PurchaseNoteSelect;

function normalizeAuditCompareValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }

  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }

  return String(value);
}

function describeChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
) {
  return Object.entries(labels)
    .filter(([key]) => normalizeAuditCompareValue(before[key]) !== normalizeAuditCompareValue(after[key]))
    .map(([, label]) => label);
}

function formatChangedFields(changedFields: string[]) {
  if (changedFields.length === 0) {
    return null;
  }

  return `Campi: ${changedFields.join(", ")}`;
}

function buildCustomerAuditSnapshot(customer: {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pec?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  uniqueCode?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    phone: customer.phone || null,
    whatsapp: customer.whatsapp || null,
    email: customer.email || null,
    pec: customer.pec || null,
    taxCode: customer.taxCode || null,
    vatNumber: customer.vatNumber || null,
    uniqueCode: customer.uniqueCode || null,
    notes: customer.notes || null,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function buildServiceAuditSnapshot(service: {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  basePriceCents: number;
  unit: string;
  quantityTiers?: string | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: service.id,
    code: service.code || null,
    name: service.name,
    description: service.description || null,
    basePriceCents: service.basePriceCents,
    unit: service.unit,
    quantityTiers: service.quantityTiers || null,
    active: service.active,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt
  };
}

function buildBillboardBookingAuditSnapshot(booking: {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  paidCents: number;
  balanceDueCents: number;
  monitorSlot?: number | null;
  note?: string | null;
  customer: {
    id: string;
    name: string;
  };
  billboardAsset: {
    id: string;
    code: string;
    name: string;
    kind: string;
  };
}) {
  return {
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    priceCents: booking.priceCents,
    paidCents: booking.paidCents,
    balanceDueCents: booking.balanceDueCents,
    monitorSlot: booking.monitorSlot ?? null,
    note: booking.note || null,
    customer: {
      id: booking.customer.id,
      name: booking.customer.name
    },
    billboardAsset: {
      id: booking.billboardAsset.id,
      code: booking.billboardAsset.code,
      name: booking.billboardAsset.name,
      kind: booking.billboardAsset.kind
    }
  };
}

function buildStaffUserAuditSnapshot(user: {
  id: string;
  name: string;
  nickname: string;
  email: string;
  role?: string;
  active?: boolean;
  invitePreparedAt?: Date | null;
  inviteSentAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    email: user.email,
    role: user.role || null,
    active: typeof user.active === "boolean" ? user.active : null,
    invitePreparedAt: user.invitePreparedAt || null,
    inviteSentAt: user.inviteSentAt || null,
    createdAt: user.createdAt
  };
}

async function getPurchaseNoteAuditRecord(noteId: string) {
  return prisma.purchaseNote.findUnique({
    where: { id: noteId },
    select: purchaseNoteAuditSelect
  });
}

async function getBillboardBookingAuditRecord(bookingId: string) {
  return prisma.billboardBooking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      billboardAsset: true
    }
  });
}

async function getOpenPurchaseNoteByOrderId(orderId: string) {
  return prisma.purchaseNote.findFirst({
    where: {
      orderId,
      completedAt: null
    },
    orderBy: {
      createdAt: "desc"
    },
    select: purchaseNoteAuditSelect
  });
}

export type LoginActionState = {
  error: string | null;
};

export type StaffProfileActionState = {
  error: string | null;
  successMessage: string | null;
  createdNickname: string | null;
  inviteMessage: string | null;
};

export type AccessProfileActionState = {
  error: string | null;
  successMessage: string | null;
  updatedNickname: string | null;
};

export type StaffInviteSettingsActionState = {
  error: string | null;
  successMessage: string | null;
};

export type PaymentEntryActionState = {
  error: string | null;
  successMessage: string | null;
  submittedAt: string | null;
};

export async function createCustomerAction(formData: FormData) {
  const session = await requireAuth();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!name) {
    throw new Error("Il nome cliente e obbligatorio.");
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      type: parseCustomerType(formData.get("type")?.toString() || null),
      phone: phone || undefined,
      whatsapp: String(formData.get("whatsapp") || "").trim() || undefined,
      email: String(formData.get("email") || "").trim() || undefined,
      pec: String(formData.get("pec") || "").trim() || undefined,
      taxCode: String(formData.get("taxCode") || "").trim() || undefined,
      vatNumber: String(formData.get("vatNumber") || "").trim() || undefined,
      uniqueCode: String(formData.get("uniqueCode") || "").trim() || undefined,
      notes: String(formData.get("notes") || "").trim() || undefined
    }
  });

  await writeAuditLog({
    actionType: "CREATED",
    actorUserId: session.userId,
    entityId: customer.id,
    entityLabel: customer.name,
    entityType: "CUSTOMER",
    title: "Cliente creato",
    details: [customer.phone?.trim() || null, customer.email?.trim() || null].filter(Boolean).join(" • ") || null,
    snapshotAfter: buildCustomerAuditSnapshot(customer)
  });

  revalidatePath("/customers");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
  revalidateBillboardSurfaces();
}

export async function createPurchaseNoteAction(formData: FormData) {
  const session = await requireAuth();
  const note = await createPurchaseNote({
    customerId: String(formData.get("customerId") || "").trim() || undefined,
    orderId: String(formData.get("orderId") || "").trim() || undefined,
    customerName: String(formData.get("customerName") || ""),
    content: String(formData.get("content") || ""),
    urgency: parsePurchaseNoteUrgency(formData.get("urgency")?.toString() || null)
  });
  await writeAuditLog({
    actionType: "CREATED",
    actorUserId: session.userId,
    entityId: note.id,
    entityLabel: note.customerName,
    entityType: "PURCHASE_NOTE",
    title: "Voce da ordinare creata",
    details: note.content,
    snapshotAfter: serializePurchaseNote(note)
  });
  revalidateLinkedPurchaseNoteSurfaces(note.order?.id);
  return serializePurchaseNote(note);
}

export async function updatePurchaseNoteAction(formData: FormData) {
  const session = await requireAuth();
  const noteId = String(formData.get("noteId") || "");
  const previous = await getPurchaseNoteAuditRecord(noteId);
  const note = await updatePurchaseNote({
    id: noteId,
    customerId: String(formData.get("customerId") || "").trim() || undefined,
    orderId: String(formData.get("orderId") || "").trim() || undefined,
    customerName: String(formData.get("customerName") || ""),
    content: String(formData.get("content") || ""),
    urgency: parsePurchaseNoteUrgency(formData.get("urgency")?.toString() || null)
  });
  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: note.id,
    entityLabel: note.customerName,
    entityType: "PURCHASE_NOTE",
    title: "Voce da ordinare aggiornata",
    details: previous ? formatChangedFields(describeChangedFields(previous, note, {
      customerName: "Cliente",
      content: "Contenuto",
      urgency: "Urgenza",
      order: "Ordine collegato"
    })) : note.content,
    snapshotBefore: previous ? serializePurchaseNote(previous) : undefined,
    snapshotAfter: serializePurchaseNote(note)
  });
  revalidateLinkedPurchaseNoteSurfaces(note.order?.id);
  return serializePurchaseNote(note);
}

export async function completePurchaseNoteAction(formData: FormData) {
  const session = await requireAuth();
  const noteId = String(formData.get("noteId") || "");
  const previous = await getPurchaseNoteAuditRecord(noteId);
  const note = await completePurchaseNote(noteId);
  await writeAuditLog({
    actionType: "COMPLETED",
    actorUserId: session.userId,
    entityId: note.id,
    entityLabel: note.customerName,
    entityType: "PURCHASE_NOTE",
    title: "Voce da ordinare chiusa",
    details: note.content,
    snapshotBefore: previous ? serializePurchaseNote(previous) : undefined,
    snapshotAfter: serializePurchaseNote(note)
  });
  revalidateLinkedPurchaseNoteSurfaces(note.order?.id);
  return serializePurchaseNote(note);
}

export async function reopenPurchaseNoteAction(formData: FormData) {
  const session = await requireAuth();
  const noteId = String(formData.get("noteId") || "");
  const previous = await getPurchaseNoteAuditRecord(noteId);
  const note = await reopenPurchaseNote(noteId);
  await writeAuditLog({
    actionType: "REOPENED",
    actorUserId: session.userId,
    entityId: note.id,
    entityLabel: note.customerName,
    entityType: "PURCHASE_NOTE",
    title: "Voce da ordinare riaperta",
    details: note.content,
    snapshotBefore: previous ? serializePurchaseNote(previous) : undefined,
    snapshotAfter: serializePurchaseNote(note)
  });
  revalidateLinkedPurchaseNoteSurfaces(note.order?.id);
  return serializePurchaseNote(note);
}

export async function deletePurchaseNoteAction(formData: FormData) {
  const session = await requireAuth();
  const noteId = String(formData.get("noteId") || "");
  const previous = await getPurchaseNoteAuditRecord(noteId);
  const note = await deletePurchaseNote(noteId);
  if (previous) {
    await writeAuditLog({
      actionType: "DELETED",
      actorUserId: session.userId,
      entityId: previous.id,
      entityLabel: previous.customerName,
      entityType: "PURCHASE_NOTE",
      title: "Voce da ordinare eliminata",
      details: previous.content,
      snapshotBefore: serializePurchaseNote(previous)
    });
  }
  revalidateLinkedPurchaseNoteSurfaces(note.orderId);
  return note;
}

export async function restoreDeletedAuditEntryAction(formData: FormData) {
  const session = await requireAuth();
  const auditLogId = String(formData.get("auditLogId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "").trim();

  const restored = await restoreDeletedEntity(auditLogId);
  await writeAuditLog({
    actionType: "REOPENED",
    actorUserId: session.userId,
    entityId: restored.entityId,
    entityLabel: restored.entityLabel,
    entityType: restored.entityType,
    title: restored.entityType === "CUSTOMER" ? "Cliente ripristinato dal cestino" : "Voce da ordinare ripristinata dal cestino",
    snapshotAfter: restored.snapshotAfter
  });

  revalidatePath("/activity");
  revalidatePath("/activity/trash");

  if (restored.entityType === "CUSTOMER") {
    revalidatePath("/customers");
    revalidatePath(`/customers/${restored.entityId}`);
    revalidatePath("/orders/new");
    revalidatePath("/quotes/new");
    revalidateBillboardSurfaces();
  }

  if (restored.entityType === "PURCHASE_NOTE") {
    revalidateLinkedPurchaseNoteSurfaces(restored.relatedOrderId);
  }

  redirect(returnTo || restored.href);
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("id") || "");
  const previous = await prisma.customer.findUnique({ where: { id } });
  const updated = await updateCustomer({
    id,
    type: parseCustomerType(formData.get("type")?.toString() || null),
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    whatsapp: String(formData.get("whatsapp") || ""),
    email: String(formData.get("email") || ""),
    pec: String(formData.get("pec") || ""),
    taxCode: String(formData.get("taxCode") || ""),
    vatNumber: String(formData.get("vatNumber") || ""),
    uniqueCode: String(formData.get("uniqueCode") || ""),
    notes: String(formData.get("notes") || "")
  });
  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: updated.id,
    entityLabel: updated.name,
    entityType: "CUSTOMER",
    title: "Cliente aggiornato",
    details: previous ? formatChangedFields(describeChangedFields(previous, updated, {
      name: "Nome",
      type: "Tipo",
      phone: "Telefono",
      whatsapp: "WhatsApp",
      email: "Email",
      pec: "PEC",
      taxCode: "Codice fiscale",
      vatNumber: "P. IVA",
      uniqueCode: "Codice univoco",
      notes: "Note"
    })) : null,
    snapshotBefore: previous ? buildCustomerAuditSnapshot(previous) : undefined,
    snapshotAfter: buildCustomerAuditSnapshot(updated)
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomerAction(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("id") || "");
  const previous = await prisma.customer.findUnique({ where: { id } });
  await deleteCustomer(id);
  if (previous) {
    await writeAuditLog({
      actionType: "DELETED",
      actorUserId: session.userId,
      entityId: previous.id,
      entityLabel: previous.name,
      entityType: "CUSTOMER",
      title: "Cliente eliminato",
      details: [previous.phone?.trim() || null, previous.email?.trim() || null].filter(Boolean).join(" • ") || null,
      snapshotBefore: buildCustomerAuditSnapshot(previous)
    });
  }
  revalidatePath("/customers");
  redirect("/customers");
}

export async function createOrderAction(formData: FormData) {
  await requireAuth();
  const postSubmitAction = parsePostSubmitAction(formData);
  const input = parseOrderFormInput(formData);
  const order = await createOrder(input);

  revalidateOperationalSurfaces(order.id);
  if (input.materialNote) {
    revalidateLinkedPurchaseNoteSurfaces(order.id);
  }

  if (postSubmitAction === "new") {
    redirect(
      buildNextOrderEntryHref({
        isQuote: false,
        customerId: order.customerId,
        continuation: "created"
      })
    );
  }

  redirect(`/orders/${order.id}`);
}

export async function createQuoteAction(formData: FormData) {
  await requireAuth();
  const postSubmitAction = parsePostSubmitAction(formData);
  const input = parseOrderFormInput(formData, { forceQuote: true });
  const order = await createOrder(input);

  revalidateOperationalSurfaces(order.id);

  if (postSubmitAction === "new") {
    redirect(
      buildNextOrderEntryHref({
        isQuote: true,
        customerId: order.customerId,
        continuation: "created"
      })
    );
  }

  redirect(`/orders/${order.id}`);
}

export async function updateOrderAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  const isQuote = parseBooleanFlag(formData.get("isQuote"));
  const postSubmitAction = parsePostSubmitAction(formData);
  const order = await updateOrder({
    id,
    title: String(formData.get("title") || ""),
    deliveryAt: isQuote
      ? parseOptionalDateTime(formData.get("deliveryAt")?.toString() || null)
      : parseOptionalDateTime(formData.get("deliveryAt")?.toString() || null),
    appointmentAt: parseOptionalDateTime(formData.get("appointmentAt")?.toString() || null),
    appointmentNote: String(formData.get("appointmentNote") || ""),
    notes: String(formData.get("notes") || ""),
    invoiceStatus: parseInvoiceStatus(formData.get("invoiceStatus")?.toString() || null),
    isQuote
  });

  revalidateOperationalSurfaces(id);

  if (postSubmitAction === "new") {
    redirect(
      buildNextOrderEntryHref({
        isQuote: order.isQuote,
        customerId: order.customerId,
        continuation: "updated"
      })
    );
  }
}

export async function updateOrderStatusAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const status = parseOperationalStatus(formData.get("operationalStatus")?.toString() || null);
  const note = String(formData.get("note") || "");

  await updateOperationalStatus(orderId, status, note);
  revalidateOperationalSurfaces(orderId);
}

export async function updateOrderStatusDetailAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const status = parseOperationalStatus(formData.get("operationalStatus")?.toString() || null);
  const note = String(formData.get("note") || "");

  await updateOperationalStatus(orderId, status, note);
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function saveOrderMaterialNoteAction(formData: FormData) {
  const session = await requireAuth();
  const orderId = String(formData.get("orderId") || "").trim();
  const materialNote = parseOrderMaterialNoteInput(formData);

  if (!materialNote) {
    throw new Error("Inserisci il materiale da ordinare.");
  }

  const previous = await getOpenPurchaseNoteByOrderId(orderId);
  const result = await saveOrderMaterialNote({
    orderId,
    content: materialNote.content,
    urgency: materialNote.urgency,
    blockOrder: materialNote.blockOrder
  });
  await writeAuditLog({
    actionType: previous ? "UPDATED" : "CREATED",
    actorUserId: session.userId,
    entityId: result.note.id,
    entityLabel: result.note.customerName,
    entityType: "PURCHASE_NOTE",
    title: previous ? "Nota materiale aggiornata" : "Nota materiale creata",
    details: result.note.content,
    snapshotBefore: previous ? serializePurchaseNote(previous) : undefined,
    snapshotAfter: serializePurchaseNote(result.note)
  });

  revalidateOperationalSurfaces(orderId);
  revalidateLinkedPurchaseNoteSurfaces(orderId);
  redirect(`/orders/${orderId}?edit=1#order-edit-panel`);
}

export async function updateOrderItemAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const itemId = String(formData.get("itemId") || "");
  const discount = parseFlexibleAdjustmentInput(formData.get("discountValue")?.toString() || null);
  const extra = parseFlexibleAdjustmentInput(formData.get("extraValue")?.toString() || null);
  const quantityRaw = String(formData.get("quantity") || "").trim().replace(",", ".");
  const quantity = Number.parseFloat(quantityRaw || "1");

  await updateOrderItem({
    orderId,
    itemId,
    label: String(formData.get("label") || ""),
    serviceCatalogId: String(formData.get("serviceCatalogId") || "").trim() || undefined,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    catalogBasePriceCents: parseCurrencyToCents(formData.get("catalogBasePrice")?.toString() || null),
    discountMode: discount.mode,
    discountValue: discount.value,
    extraMode: extra.mode,
    extraValue: extra.value,
    format: String(formData.get("format") || ""),
    material: String(formData.get("material") || ""),
    finishing: String(formData.get("finishing") || ""),
    notes: String(formData.get("notes") || "")
  });

  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function restoreOrderHistoryAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const historyId = String(formData.get("historyId") || "");
  const returnTo = String(formData.get("returnTo") || "").trim();

  await restoreOrderHistoryEntry(orderId, historyId);
  revalidateOperationalSurfaces(orderId);
  redirect(returnTo || `/orders/${orderId}#order-history-panel`);
}

export async function createOrderItemAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const discount = parseFlexibleAdjustmentInput(formData.get("discountValue")?.toString() || null);
  const extra = parseFlexibleAdjustmentInput(formData.get("extraValue")?.toString() || null);
  const quantityRaw = String(formData.get("quantity") || "").trim().replace(",", ".");
  const quantity = Number.parseFloat(quantityRaw || "1");

  const item = await createOrderItem({
    orderId,
    label: String(formData.get("label") || ""),
    serviceCatalogId: String(formData.get("serviceCatalogId") || "").trim() || undefined,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    catalogBasePriceCents: parseCurrencyToCents(formData.get("catalogBasePrice")?.toString() || null),
    discountMode: discount.mode,
    discountValue: discount.value,
    extraMode: extra.mode,
    extraValue: extra.value,
    format: String(formData.get("format") || ""),
    material: String(formData.get("material") || ""),
    finishing: String(formData.get("finishing") || ""),
    notes: String(formData.get("notes") || "")
  });

  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}?item=${item.id}#item-${item.id}`);
}

export async function toggleOrderItemDeliveryAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const itemId = String(formData.get("itemId") || "");
  const delivered = String(formData.get("delivered") || "") === "true";

  await toggleOrderItemDelivery({ orderId, itemId, delivered });
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function cloneOrderItemAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const itemId = String(formData.get("itemId") || "");

  await cloneOrderItem({ orderId, itemId });
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function deleteOrderItemAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const itemId = String(formData.get("itemId") || "");

  await deleteOrderItem({ orderId, itemId });
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function transitionPhaseAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const nextPhase = parseMainPhase(formData.get("nextPhase")?.toString() || null);
  const note = String(formData.get("note") || "");

  await transitionOrderPhase(orderId, nextPhase, note);
  revalidateOperationalSurfaces(orderId);
}

export async function recordPaymentAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const amountCents = parseCurrencyToCents(formData.get("amount")?.toString() || null);
  const method = parsePaymentMethod(formData.get("method")?.toString() || null);
  const note = String(formData.get("note") || "");

  await recordPayment(orderId, amountCents, method, note);
  revalidateOperationalSurfaces(orderId);
}

export async function recordPaymentEntryAction(
  _previousState: PaymentEntryActionState,
  formData: FormData
): Promise<PaymentEntryActionState> {
  try {
    await requireAuth();
    const orderId = String(formData.get("orderId") || "");
    const amountCents = parseCurrencyToCents(formData.get("amount")?.toString() || null);
    const method = parsePaymentMethod(formData.get("method")?.toString() || null);
    const note = String(formData.get("note") || "");

    await recordPayment(orderId, amountCents, method, note);
    revalidateOperationalSurfaces(orderId);

    return {
      error: null,
      successMessage: "Pagamento registrato.",
      submittedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Non sono riuscito a registrare il pagamento.",
      successMessage: null,
      submittedAt: null
    };
  }
}

export async function correctPaymentAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const paymentId = String(formData.get("paymentId") || "");
  const amountCents = parseCurrencyToCents(formData.get("amount")?.toString() || null);
  const method = parsePaymentMethod(formData.get("method")?.toString() || null);
  const note = String(formData.get("note") || "");

  await correctPayment(orderId, paymentId, amountCents, method, note);
  revalidateOperationalSurfaces(orderId);
}

export async function quickUpdatePhaseAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const nextPhase = parseMainPhase(formData.get("nextPhase")?.toString() || null);
  await transitionOrderPhase(orderId, nextPhase);
  revalidateOperationalSurfaces(orderId);
}

export async function quickUpdateOperationalStatusAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const status = parseOperationalStatus(formData.get("operationalStatus")?.toString() || null);
  await updateOperationalStatus(orderId, status);
  revalidateOperationalSurfaces(orderId);
}

type ProductionMoveTarget = "PLANNING" | "WORKING" | "READY" | "BLOCKED";

const productionBlockedStatuses = new Set<OperationalStatus>([
  "IN_ATTESA_FILE",
  "IN_ATTESA_MATERIALE",
  "IN_ATTESA_APPROVAZIONE"
]);

const productionPhaseTargets: Record<Exclude<ProductionMoveTarget, "BLOCKED">, MainPhase> = {
  PLANNING: "ACCETTATO",
  WORKING: "IN_LAVORAZIONE",
  READY: "SVILUPPO_COMPLETATO"
};

const validMainPhases = new Set<MainPhase>([
  "ACCETTATO",
  "CALENDARIZZATO",
  "IN_LAVORAZIONE",
  "SVILUPPO_COMPLETATO",
  "CONSEGNATO"
]);

function isProductionMoveTarget(value: unknown): value is ProductionMoveTarget {
  return value === "PLANNING" || value === "WORKING" || value === "READY" || value === "BLOCKED";
}

export async function moveOrderInProductionAction(input: {
  orderId: string;
  target: ProductionMoveTarget;
  blockedStatus?: OperationalStatus;
  note?: string;
  restorePhase?: MainPhase;
}) {
  await requireAuth();

  const orderId = input.orderId.trim();
  if (!orderId || !isProductionMoveTarget(input.target)) {
    throw new Error("Spostamento ordine non valido.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      mainPhase: true,
      operationalStatus: true
    }
  });

  if (!order || order.mainPhase === "CONSEGNATO") {
    throw new Error("Ordine non disponibile in produzione.");
  }

  if (input.target === "BLOCKED") {
    if (!input.blockedStatus || !productionBlockedStatuses.has(input.blockedStatus)) {
      throw new Error("Scegli il motivo della sospensione.");
    }

    const note = input.note?.trim();
    if (!note) {
      throw new Error("Indica il motivo della sospensione.");
    }

    if (input.restorePhase && validMainPhases.has(input.restorePhase)) {
      if (!canTransitionPhase(order.mainPhase, input.restorePhase)) {
        throw new Error("Puoi spostare un ordine di una fase alla volta.");
      }

      if (normalizeMainPhaseForWorkflow(order.mainPhase) !== normalizeMainPhaseForWorkflow(input.restorePhase)) {
        await transitionOrderPhase(orderId, input.restorePhase);
      }
    }

    await updateOperationalStatus(orderId, input.blockedStatus, note);
    revalidateOperationalSurfaces(orderId);
    return { message: `Ordine sospeso: ${operationalStatusLabels[input.blockedStatus]}.` };
  }

  const nextPhase = productionPhaseTargets[input.target];
  if (!canTransitionPhase(order.mainPhase, nextPhase)) {
    throw new Error("Puoi spostare un ordine di una fase alla volta.");
  }

  if (order.operationalStatus !== "ATTIVO") {
    await updateOperationalStatus(orderId, "ATTIVO");
  }

  if (normalizeMainPhaseForWorkflow(order.mainPhase) !== normalizeMainPhaseForWorkflow(nextPhase)) {
    await transitionOrderPhase(orderId, nextPhase);
  }

  revalidateOperationalSurfaces(orderId);
  return { message: `Ordine spostato in ${mainPhaseLabels[nextPhase]}.` };
}

export async function quickUpdateQuoteFlagAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const isQuote = String(formData.get("isQuote") || "") === "true";
  try {
    await updateOrderQuoteFlag(orderId, isQuote);
  } catch (error) {
    if (!isQuote && error instanceof Error && error.message.includes("Definisci prima")) {
      redirect(`/orders/${orderId}?needsScheduling=1#order-edit-panel`);
    }
    throw error;
  }
  revalidateOperationalSurfaces(orderId);
}

export async function markOrderInvoicedAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  const nextInvoiceStatus = parseInvoiceStatus(formData.get("nextInvoiceStatus")?.toString() || null);
  await updateOrderInvoiceStatus(orderId, nextInvoiceStatus);
  revalidateOperationalSurfaces(orderId);
}

function normalizeBulkOrderIds(orderIds: string[]) {
  return [...new Set(orderIds.map((entry) => entry.trim()).filter(Boolean))];
}

function buildBulkOrderMutationMessage(actionLabel: string, updatedCount: number, skippedCount: number) {
  if (updatedCount === 0 && skippedCount === 0) {
    return "Seleziona almeno un ordine.";
  }

  if (skippedCount === 0) {
    return `${actionLabel} applicata a ${updatedCount} ${updatedCount === 1 ? "ordine" : "ordini"}.`;
  }

  if (updatedCount === 0) {
    return `Nessun ordine aggiornato. ${skippedCount} ${skippedCount === 1 ? "voce saltata" : "voci saltate"}.`;
  }

  return `${actionLabel} applicata a ${updatedCount} ${updatedCount === 1 ? "ordine" : "ordini"}, con ${skippedCount} ${skippedCount === 1 ? "voce saltata" : "voci saltate"}.`;
}

export async function bulkUpdateOrdersInvoiceStatusAction(input: {
  orderIds: string[];
  nextInvoiceStatus: string;
}) {
  await requireAuth();
  const orderIds = normalizeBulkOrderIds(input.orderIds);
  const nextInvoiceStatus = parseInvoiceStatus(input.nextInvoiceStatus);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const orderId of orderIds) {
    try {
      await updateOrderInvoiceStatus(orderId, nextInvoiceStatus);
      updatedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  revalidateOperationalSurfaces();

  return {
    updatedCount,
    skippedCount,
    message: buildBulkOrderMutationMessage("Fatturazione", updatedCount, skippedCount)
  };
}

export async function bulkUpdateOrdersPhaseAction(input: {
  orderIds: string[];
  nextPhase: string;
}) {
  await requireAuth();
  const orderIds = normalizeBulkOrderIds(input.orderIds);
  const nextPhase = parseMainPhase(input.nextPhase);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const orderId of orderIds) {
    try {
      await transitionOrderPhase(orderId, nextPhase);
      updatedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  revalidateOperationalSurfaces();

  return {
    updatedCount,
    skippedCount,
    message: buildBulkOrderMutationMessage("Fase lavoro", updatedCount, skippedCount)
  };
}

export async function bulkUpdateOrdersOperationalStatusAction(input: {
  orderIds: string[];
  operationalStatus: string;
}) {
  await requireAuth();
  const orderIds = normalizeBulkOrderIds(input.orderIds);
  const operationalStatus = parseOperationalStatus(input.operationalStatus);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const orderId of orderIds) {
    try {
      await updateOperationalStatus(orderId, operationalStatus);
      updatedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  revalidateOperationalSurfaces();

  return {
    updatedCount,
    skippedCount,
    message: buildBulkOrderMutationMessage("Stato operativo", updatedCount, skippedCount)
  };
}

export async function confirmQuoteAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  try {
    await updateOrderQuoteFlag(orderId, false);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Definisci prima")) {
      redirect(`/orders/${orderId}?needsScheduling=1#order-edit-panel`);
    }
    throw error;
  }
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}`);
}

export async function markReadyAction(formData: FormData) {
  await requireAuth();
  const orderId = String(formData.get("orderId") || "");
  await markOrderReady(orderId);
  revalidateOperationalSurfaces(orderId);
}

export async function createBillboardBookingAction(formData: FormData) {
  const session = await requireAuth();

  const billboardAssetIds = formData
    .getAll("billboardAssetIds")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const monitorSlotsByAssetId = parseBillboardMonitorSlots(formData.get("monitorSlotsPayload")?.toString() || null);
  const customerId = String(formData.get("customerId") || "").trim();
  const customer = parseBillboardBookingCustomerInput(formData);

  if (billboardAssetIds.length === 0) {
    throw new Error("Seleziona almeno un impianto pubblicitario.");
  }

  if (!customerId && !customer.name) {
    throw new Error("Seleziona un cliente o inseriscine uno nuovo.");
  }

  const startsAt = parseBillboardBookingDate(formData.get("startsAt")?.toString() || null, "Data inizio");
  const endsAt = parseBillboardBookingDate(formData.get("endsAt")?.toString() || null, "Data fine");
  const priceCents = parseCurrencyToCents(formData.get("price")?.toString() || null);
  const paidCents = parseCurrencyToCents(formData.get("paid")?.toString() || null);
  const note = String(formData.get("note") || "");

  try {
    const bookings = await createBillboardBookings({
      billboardAssetIds,
      monitorSlotsByAssetId,
      customerId: customerId || undefined,
      customer,
      startsAt,
      endsAt,
      priceCents,
      paidCents,
      note
    });

    await Promise.all(
      bookings.map((booking) =>
        writeAuditLog({
          actionType: "CREATED",
          actorUserId: session.userId,
          entityId: booking.id,
          entityLabel: booking.billboardAsset.name,
          entityType: "BILLBOARD_BOOKING",
          title: "Prenotazione cartellone creata",
          details: `${booking.customer.name} • ${formatDateKey(booking.startsAt)} - ${formatDateKey(booking.endsAt)}${booking.monitorSlot ? ` • Slot ${booking.monitorSlot}` : ""}`,
          snapshotAfter: buildBillboardBookingAuditSnapshot(booking)
        })
      )
    );

    revalidateBillboardSurfaces();
    redirect(`/billboards?date=${formatDateKey(bookings[0].startsAt)}`);
  } catch (error) {
    throw error;
  }
}

export async function updateBillboardBookingAction(formData: FormData) {
  const session = await requireAuth();
  const bookingId = String(formData.get("bookingId") || "").trim();
  const billboardAssetId = String(formData.get("billboardAssetId") || "").trim();
  const customerId = String(formData.get("customerId") || "").trim();
  const customer = parseBillboardBookingCustomerInput(formData);
  const startsAt = parseBillboardBookingDate(formData.get("startsAt")?.toString() || null, "Data inizio");
  const endsAt = parseBillboardBookingDate(formData.get("endsAt")?.toString() || null, "Data fine");
  const priceCents = parseCurrencyToCents(formData.get("price")?.toString() || null);
  const paidCents = parseCurrencyToCents(formData.get("paid")?.toString() || null);
  const note = String(formData.get("note") || "");
  const previous = await getBillboardBookingAuditRecord(bookingId);
  const monitorSlotsByAssetId = parseBillboardMonitorSlots(formData.get("monitorSlotsPayload")?.toString() || null);
  const monitorSlot = monitorSlotsByAssetId[billboardAssetId];

  if (!bookingId) {
    throw new Error("Prenotazione non trovata.");
  }

  if (!billboardAssetId) {
    throw new Error("Seleziona un impianto pubblicitario.");
  }

  if (!customerId && !customer.name) {
    throw new Error("Seleziona un cliente o inseriscine uno nuovo.");
  }

  const booking = await updateBillboardBooking({
    id: bookingId,
    billboardAssetId,
    monitorSlot: typeof monitorSlot === "number" ? monitorSlot : null,
    customerId: customerId || undefined,
    customer,
    startsAt,
    endsAt,
    priceCents,
    paidCents,
    note
  });

  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: booking.id,
    entityLabel: booking.billboardAsset.name,
    entityType: "BILLBOARD_BOOKING",
    title: "Prenotazione cartellone aggiornata",
    details: `${booking.customer.name} • ${formatDateKey(booking.startsAt)} - ${formatDateKey(booking.endsAt)}${booking.monitorSlot ? ` • Slot ${booking.monitorSlot}` : ""}`,
    snapshotBefore: previous ? buildBillboardBookingAuditSnapshot(previous) : undefined,
    snapshotAfter: buildBillboardBookingAuditSnapshot(booking)
  });

  revalidateBillboardSurfaces();
  redirect(`/billboards?date=${formatDateKey(booking.startsAt)}`);
}

export async function deleteBillboardBookingAction(formData: FormData) {
  const session = await requireAuth();
  const bookingId = String(formData.get("bookingId") || "").trim();
  const previous = await getBillboardBookingAuditRecord(bookingId);

  if (!bookingId || !previous) {
    throw new Error("Prenotazione non trovata.");
  }

  const deleted = await deleteBillboardBooking(bookingId);

  await writeAuditLog({
    actionType: "DELETED",
    actorUserId: session.userId,
    entityId: deleted.id,
    entityLabel: deleted.billboardAsset.name,
    entityType: "BILLBOARD_BOOKING",
    title: "Prenotazione cartellone eliminata",
    details: `${deleted.customer.name} • ${formatDateKey(deleted.startsAt)} - ${formatDateKey(deleted.endsAt)}${deleted.monitorSlot ? ` • Slot ${deleted.monitorSlot}` : ""}`,
    snapshotBefore: buildBillboardBookingAuditSnapshot(previous)
  });

  revalidateBillboardSurfaces();
  redirect(`/billboards?date=${formatDateKey(deleted.startsAt)}`);
}

function parseBillboardMonitorSlots(raw: string | null) {
  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, number> = {};

    for (const [assetId, value] of Object.entries(parsed)) {
      const numeric = Number(value);
      if (!assetId.trim() || !Number.isInteger(numeric)) {
        continue;
      }

      next[assetId] = numeric;
    }

    return next;
  } catch {
    return {};
  }
}

function parseBillboardBookingCustomerInput(formData: FormData) {
  return {
    type: parseCustomerType(formData.get("customerType")?.toString() || null),
    name: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("customerPhone") || "").trim(),
    whatsapp: String(formData.get("customerWhatsapp") || "").trim(),
    email: String(formData.get("customerEmail") || "").trim(),
    pec: String(formData.get("customerPec") || "").trim(),
    taxCode: String(formData.get("customerTaxCode") || "").trim(),
    vatNumber: String(formData.get("customerVatNumber") || "").trim(),
    uniqueCode: String(formData.get("customerUniqueCode") || "").trim(),
    notes: String(formData.get("customerNotes") || "").trim()
  };
}

export async function createServiceAction(formData: FormData) {
  const session = await requireAuth();
  const service = await createService(
    String(formData.get("code") || ""),
    String(formData.get("name") || ""),
    String(formData.get("description") || "") || undefined,
    parseCurrencyToCents(formData.get("basePrice")?.toString() || null),
    parseServiceUnit(formData.get("unit")),
    String(formData.get("quantityTiers") || "")
  );
  await writeAuditLog({
    actionType: "CREATED",
    actorUserId: session.userId,
    entityId: service.id,
    entityLabel: service.name,
    entityType: "SERVICE_CATALOG",
    title: "Servizio creato",
    details: service.code || null,
    snapshotAfter: buildServiceAuditSnapshot(service)
  });

  revalidatePath("/settings");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
}

export async function updateServiceAction(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("id") || "");
  const previous = await prisma.serviceCatalog.findUnique({ where: { id } });
  const service = await updateServiceCatalogEntry({
    id,
    code: String(formData.get("code") || ""),
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    basePriceCents: parseCurrencyToCents(formData.get("basePrice")?.toString() || null),
    unit: parseServiceUnit(formData.get("unit")),
    quantityTiers: String(formData.get("quantityTiers") || ""),
    active: parseBooleanFlag(formData.get("active"))
  });
  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: service.id,
    entityLabel: service.name,
    entityType: "SERVICE_CATALOG",
    title: "Servizio aggiornato",
    details: previous ? formatChangedFields(describeChangedFields(previous, service, {
      code: "Codice",
      name: "Nome",
      description: "Descrizione",
      basePriceCents: "Prezzo base",
      unit: "Unita",
      quantityTiers: "Scaglioni",
      active: "Attivo"
    })) : null,
    snapshotBefore: previous ? buildServiceAuditSnapshot(previous) : undefined,
    snapshotAfter: buildServiceAuditSnapshot(service)
  });

  revalidatePath("/settings");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
}

export async function saveWhatsappTemplateAction(formData: FormData) {
  const session = await requireAuth();
  const template = String(formData.get("template") || "").trim();
  if (!template) {
    throw new Error("Il template WhatsApp non puo essere vuoto.");
  }

  const previous = await prisma.appSetting.findUnique({
    where: { key: "whatsappTemplate" },
    select: { key: true, value: true }
  });
  await saveSetting("whatsappTemplate", template);
  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: "whatsappTemplate",
    entityLabel: "Template WhatsApp",
    entityType: "APP_SETTING",
    title: "Template WhatsApp aggiornato",
    details: previous?.value === template ? null : "Contenuto messaggio aggiornato",
    snapshotBefore: previous ? { [previous.key]: previous.value } : undefined,
    snapshotAfter: { whatsappTemplate: template }
  });
  revalidatePath("/settings");
}

export async function saveStaffInviteSettingsAction(
  _: StaffInviteSettingsActionState,
  formData: FormData
): Promise<StaffInviteSettingsActionState> {
  const session = await requireAdmin();

  const accessBaseUrl = String(formData.get("accessBaseUrl") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const template = String(formData.get("template") || "").trim();

  if (!subject) {
    return {
      error: "L'oggetto della mail e obbligatorio.",
      successMessage: null
    };
  }

  if (!template) {
    return {
      error: "La bozza del messaggio e obbligatoria.",
      successMessage: null
    };
  }

  if (accessBaseUrl && !normalizeStaffAccessBaseUrl(accessBaseUrl)) {
    return {
      error: "L'URL base di accesso non e valido.",
      successMessage: null
    };
  }

  const previousSettings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: ["staffAccessBaseUrl", "staffInviteEmailSubject", "staffInviteEmailTemplate"]
      }
    },
    select: {
      key: true,
      value: true
    }
  });
  const previousSnapshot = Object.fromEntries(previousSettings.map((entry) => [entry.key, entry.value]));
  const nextSnapshot = {
    staffAccessBaseUrl: accessBaseUrl,
    staffInviteEmailSubject: subject,
    staffInviteEmailTemplate: template
  };

  await Promise.all([
    saveSetting("staffAccessBaseUrl", accessBaseUrl),
    saveSetting("staffInviteEmailSubject", subject),
    saveSetting("staffInviteEmailTemplate", template)
  ]);

  await writeAuditLog({
    actionType: "UPDATED",
    actorUserId: session.userId,
    entityId: "staffInviteSettings",
    entityLabel: "Invito staff",
    entityType: "APP_SETTING",
    title: "Impostazioni invito staff aggiornate",
    details: formatChangedFields(describeChangedFields(previousSnapshot, nextSnapshot, {
      staffAccessBaseUrl: "URL accesso",
      staffInviteEmailSubject: "Oggetto",
      staffInviteEmailTemplate: "Testo"
    })),
    snapshotBefore: previousSnapshot,
    snapshotAfter: nextSnapshot
  });

  revalidatePath("/settings/staff");

  return {
    error: null,
    successMessage: "Bozza invito aggiornata."
  };
}

export async function createStaffUserAction(
  _: StaffProfileActionState,
  formData: FormData
): Promise<StaffProfileActionState> {
  const session = await requireAdmin();

  try {
    const user = await createStaffUser({
      name: String(formData.get("name") || ""),
      nickname: String(formData.get("nickname") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      role: parseUserRole(formData.get("role")?.toString() || null)
    });
    const inviteConfig = await getStaffInviteConfig({
      requestBaseUrl: getRequestBaseUrl(headers())
    });
    const inviteDelivery = await sendStaffInviteEmail({
      userId: user.id,
      name: user.name,
      nickname: user.nickname,
      email: user.email,
      subject: inviteConfig.subject,
      template: inviteConfig.template,
      accessBaseUrl: inviteConfig.accessBaseUrl
    });
    const auditUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        role: true,
        active: true,
        invitePreparedAt: true,
        inviteSentAt: true,
        createdAt: true
      }
    });

    await writeAuditLog({
      actionType: "CREATED",
      actorUserId: session.userId,
      entityId: auditUser.id,
      entityLabel: auditUser.name,
      entityType: "STAFF_USER",
      title: "Profilo staff creato",
      details: inviteDelivery.sent ? "Invito email inviato" : "Profilo creato con bozza invito pronta",
      snapshotAfter: buildStaffUserAuditSnapshot(auditUser)
    });

    revalidatePath("/settings");
    revalidatePath("/settings/staff");
    const params = new URLSearchParams({
      created: user.name,
      nickname: user.nickname,
      invite: inviteDelivery.sent ? "sent" : "draft"
    });
    redirect(`/settings/staff?${params.toString()}`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossibile creare il profilo staff.",
      successMessage: null,
      createdNickname: null,
      inviteMessage: null
    };
  }
}

export async function updateOwnNicknameAction(
  _: AccessProfileActionState,
  formData: FormData
): Promise<AccessProfileActionState> {
  const session = await requireAuth();

  try {
    const previous = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        role: true,
        active: true,
        invitePreparedAt: true,
        inviteSentAt: true,
        createdAt: true
      }
    });
    const user = await updateOwnStaffNickname(session.userId, String(formData.get("nickname") || ""));
    await writeAuditLog({
      actionType: "UPDATED",
      actorUserId: session.userId,
      entityId: user.id,
      entityLabel: user.name,
      entityType: "STAFF_USER",
      title: "Nickname accesso aggiornato",
      details: previous ? formatChangedFields(describeChangedFields(previous, user, { nickname: "Nickname" })) : null,
      snapshotBefore: previous ? buildStaffUserAuditSnapshot(previous) : undefined,
      snapshotAfter: buildStaffUserAuditSnapshot(user)
    });

    revalidatePath("/settings");

    return {
      error: null,
      successMessage: "Nickname aggiornato con successo.",
      updatedNickname: user.nickname
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Impossibile aggiornare il nickname.",
      successMessage: null,
      updatedNickname: null
    };
  }
}

export async function deleteOrderAction(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("id") || "");
  const order = await deleteOrder(id);
  await writeAuditLog({
    actionType: "DELETED",
    actorUserId: session.userId,
    entityId: order.id,
    entityLabel: getDisplayOrderLabel(order.orderCode, order.title),
    entityType: "ORDER",
    title: order.isQuote ? "Preventivo eliminato" : "Ordine eliminato",
    details: `${order.attachments.length} allegati rimossi`,
    snapshotBefore: {
      id: order.id,
      orderCode: order.orderCode,
      title: order.title,
      isQuote: order.isQuote,
      mainPhase: order.mainPhase,
      deliveryAt: order.deliveryAt,
      totalCents: order.totalCents,
      invoiceStatus: order.invoiceStatus,
      paymentStatus: order.paymentStatus,
      attachments: order.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        filePath: attachment.filePath
      }))
    }
  });
  await cleanupOrderAttachments(order.attachments);
  revalidateOperationalSurfaces();
  redirect(order.isQuote ? "/quotes" : order.mainPhase === "CONSEGNATO" ? "/orders?view=DELIVERED" : "/orders");
}

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const nickname = String(formData.get("nickname") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const user = await authenticateUser(nickname, password);
    await createSessionForUser(user);
  } catch (error) {
    console.error("Login failed", error);
    return {
      error: describeLoginFailure(error)
    };
  }

  redirect("/");
}
