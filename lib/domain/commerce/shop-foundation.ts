export const DEFAULT_SHOP_PUBLIC_BASE_URL = "https://shop.28print.it";

export const salesOrderStatuses = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "PAYMENT_FAILED",
  "CANCELLED",
  "FULFILLED"
] as const;

export const salesOrderOrigins = ["SHOP_ONLINE"] as const;

export type SalesOrderStatus = (typeof salesOrderStatuses)[number];
export type SalesOrderOrigin = (typeof salesOrderOrigins)[number];
export type SalesOrderBillingPartyKind = "PRIVATE" | "BUSINESS" | "PROFESSIONAL";
export type SalesOrderItemJobCreationReason =
  | "AUTO_PRODUCT_POLICY"
  | "INVOICE_REQUESTED"
  | "AUTO_PRODUCT_POLICY_AND_INVOICE_REQUESTED";

export type SalesOrderBillingSnapshot = {
  kind: SalesOrderBillingPartyKind;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  sdiCode?: string | null;
  pec?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

function normalizePublicBaseUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveShopPublicBaseUrl(value = process.env.SHOP_PUBLIC_BASE_URL) {
  return normalizePublicBaseUrl(value) || DEFAULT_SHOP_PUBLIC_BASE_URL;
}

export function shouldCreateSalesOrderItemJob(input: {
  createJobAutomatically?: boolean | null;
  invoiceRequested?: boolean | null;
}) {
  return Boolean(input.createJobAutomatically) || Boolean(input.invoiceRequested);
}

export function resolveSalesOrderItemJobCreationReason(input: {
  createJobAutomatically?: boolean | null;
  invoiceRequested?: boolean | null;
}): SalesOrderItemJobCreationReason | null {
  const createJobAutomatically = Boolean(input.createJobAutomatically);
  const invoiceRequested = Boolean(input.invoiceRequested);

  if (createJobAutomatically && invoiceRequested) {
    return "AUTO_PRODUCT_POLICY_AND_INVOICE_REQUESTED";
  }

  if (createJobAutomatically) {
    return "AUTO_PRODUCT_POLICY";
  }

  if (invoiceRequested) {
    return "INVOICE_REQUESTED";
  }

  return null;
}

export function resolveSalesOrderStatusAfterPayment(paymentSucceeded: boolean): SalesOrderStatus {
  return paymentSucceeded ? "PAID" : "PAYMENT_FAILED";
}
