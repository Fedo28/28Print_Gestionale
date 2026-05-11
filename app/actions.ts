"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createBillboardBookings, parseBillboardBookingDate } from "@/lib/billboards";
import {
  parseCustomerType,
  parseBooleanFlag,
  parseCurrencyToCents,
  parseDateTime,
  parseInvoiceStatus,
  parseItemsPayload,
  parseMainPhase,
  parseOptionalDateTime,
  parseOperationalStatus,
  parsePaymentMethod,
  parseUserRole
} from "@/lib/forms";
import { formatDateKey } from "@/lib/format";
import type { DiscountMode } from "@prisma/client";
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
  updateOrder
} from "@/lib/orders";
import { authenticateUser, createSessionForUser, describeLoginFailure, requireAdmin, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestBaseUrl } from "@/lib/request-url";
import { saveSetting } from "@/lib/settings";
import { cleanupOrderAttachments } from "@/lib/storage";
import {
  createStaffUser,
  getStaffInviteConfig,
  normalizeStaffAccessBaseUrl,
  sendStaffInviteEmail,
  updateOwnStaffNickname
} from "@/lib/staff-users";
import { parseServiceUnit } from "@/lib/service-units";
import { parseFlexibleAdjustmentInput } from "@/lib/pricing";

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

function parseOrderFormInput(formData: FormData, options?: { forceQuote?: boolean }) {
  const isQuote = options?.forceQuote ?? parseBooleanFlag(formData.get("isQuote"));
  const globalDiscount = parseFlexibleAdjustmentInput(formData.get("globalDiscount")?.toString() || null);
  const globalExtra = parseFlexibleAdjustmentInput(formData.get("globalExtra")?.toString() || null);
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
    deliveryAt: isQuote
      ? parseOptionalDateTime(formData.get("deliveryAt")?.toString() || null)
      : parseDateTime(formData.get("deliveryAt")?.toString() || null),
    appointmentAt: parseOptionalDateTime(formData.get("appointmentAt")?.toString() || null),
    appointmentNote: String(formData.get("appointmentNote") || ""),
    notes: String(formData.get("notes") || ""),
    invoiceStatus: parseInvoiceStatus(formData.get("invoiceStatus")?.toString() || null),
    isQuote,
    items: parseItemsPayload(formData.get("itemsPayload")?.toString() || null),
    globalDiscountMode: globalDiscount.mode,
    globalDiscountValue: globalDiscount.value,
    globalExtraMode: globalExtra.mode,
    globalExtraValue: globalExtra.value,
    initialDepositCents: parseCurrencyToCents(formData.get("initialDeposit")?.toString() || null)
  };
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

export async function createCustomerAction(formData: FormData) {
  await requireAuth();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!name) {
    throw new Error("Il nome cliente e obbligatorio.");
  }

  await prisma.customer.create({
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

  revalidatePath("/customers");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
  revalidateBillboardSurfaces();
}

export async function updateCustomerAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  await updateCustomer({
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

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomerAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  await deleteCustomer(id);
  revalidatePath("/customers");
  redirect("/customers");
}

export async function createOrderAction(formData: FormData) {
  await requireAuth();
  const order = await createOrder(parseOrderFormInput(formData));

  revalidateOperationalSurfaces(order.id);
  redirect(`/orders/${order.id}`);
}

export async function createQuoteAction(formData: FormData) {
  await requireAuth();
  const order = await createOrder(parseOrderFormInput(formData, { forceQuote: true }));

  revalidateOperationalSurfaces(order.id);
  redirect(`/orders/${order.id}`);
}

export async function updateOrderAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  const isQuote = parseBooleanFlag(formData.get("isQuote"));
  await updateOrder({
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

  await restoreOrderHistoryEntry(orderId, historyId);
  revalidateOperationalSurfaces(orderId);
  redirect(`/orders/${orderId}#order-history-panel`);
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
  await requireAuth();

  const billboardAssetIds = formData
    .getAll("billboardAssetIds")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const monitorSlotsByAssetId = parseBillboardMonitorSlots(formData.get("monitorSlotsPayload")?.toString() || null);
  const customerId = String(formData.get("customerId") || "").trim();

  if (billboardAssetIds.length === 0) {
    throw new Error("Seleziona almeno un impianto pubblicitario.");
  }

  if (!customerId) {
    throw new Error("Seleziona un cliente.");
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
      customerId,
      startsAt,
      endsAt,
      priceCents,
      paidCents,
      note
    });

    revalidateBillboardSurfaces();
    redirect(`/billboards?date=${formatDateKey(bookings[0].startsAt)}`);
  } catch (error) {
    throw error;
  }
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

export async function createServiceAction(formData: FormData) {
  await requireAuth();
  await createService(
    String(formData.get("code") || ""),
    String(formData.get("name") || ""),
    String(formData.get("description") || "") || undefined,
    parseCurrencyToCents(formData.get("basePrice")?.toString() || null),
    parseServiceUnit(formData.get("unit")),
    String(formData.get("quantityTiers") || "")
  );

  revalidatePath("/settings");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
}

export async function updateServiceAction(formData: FormData) {
  await requireAuth();
  await updateServiceCatalogEntry({
    id: String(formData.get("id") || ""),
    code: String(formData.get("code") || ""),
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    basePriceCents: parseCurrencyToCents(formData.get("basePrice")?.toString() || null),
    unit: parseServiceUnit(formData.get("unit")),
    quantityTiers: String(formData.get("quantityTiers") || ""),
    active: parseBooleanFlag(formData.get("active"))
  });

  revalidatePath("/settings");
  revalidatePath("/orders/new");
  revalidatePath("/quotes/new");
}

export async function saveWhatsappTemplateAction(formData: FormData) {
  await requireAuth();
  const template = String(formData.get("template") || "").trim();
  if (!template) {
    throw new Error("Il template WhatsApp non puo essere vuoto.");
  }

  await saveSetting("whatsappTemplate", template);
  revalidatePath("/settings");
}

export async function saveStaffInviteSettingsAction(
  _: StaffInviteSettingsActionState,
  formData: FormData
): Promise<StaffInviteSettingsActionState> {
  await requireAdmin();

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

  await Promise.all([
    saveSetting("staffAccessBaseUrl", accessBaseUrl),
    saveSetting("staffInviteEmailSubject", subject),
    saveSetting("staffInviteEmailTemplate", template)
  ]);

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
  await requireAdmin();

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
    const user = await updateOwnStaffNickname(session.userId, String(formData.get("nickname") || ""));

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
  await requireAuth();
  const id = String(formData.get("id") || "");
  const order = await deleteOrder(id);
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
