import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  readCustomerAccountSession
} from "@/lib/customer-account-auth";
import { parseQuantityValue } from "@/lib/pricing";
import {
  getShopBetaBlockedMessage,
  getShopBetaGateState,
  SHOP_BETA_ACCESS_COOKIE
} from "@/lib/shop-beta-gate";
import {
  createShopSalesOrder,
  describeShopSalesOrderFailure,
  type CreateShopSalesOrderBillingInput
} from "@/lib/shop-orders";
import {
  buildShopDocumentBundleDetailedSummary,
  normalizeShopDocumentBundle,
  type ShopDocumentBundleInput
} from "@/lib/shop-print-config";

export const runtime = "nodejs";

function hasDocumentSelection(value: unknown): value is ShopDocumentBundleInput {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as { documents?: unknown };
  return Array.isArray(record.documents) && record.documents.length > 0;
}

function readBillingDetailsInput(value: unknown): CreateShopSalesOrderBillingInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    addressLine1: String(record.addressLine1 || ""),
    addressLine2: String(record.addressLine2 || ""),
    city: String(record.city || ""),
    companyName: String(record.companyName || ""),
    country: String(record.country || ""),
    fullName: String(record.fullName || ""),
    kind: String(record.kind || "") as CreateShopSalesOrderBillingInput["kind"],
    pec: String(record.pec || ""),
    phone: String(record.phone || ""),
    postalCode: String(record.postalCode || ""),
    province: String(record.province || ""),
    sdiCode: String(record.sdiCode || ""),
    taxCode: String(record.taxCode || ""),
    vatNumber: String(record.vatNumber || "")
  };
}

export async function POST(request: NextRequest) {
  const betaGate = getShopBetaGateState(request.cookies.get(SHOP_BETA_ACCESS_COOKIE)?.value);
  if (!betaGate.allowed) {
    return NextResponse.json({ error: getShopBetaBlockedMessage(betaGate) }, { status: 403 });
  }

  const session = readCustomerAccountSession(
    request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );

  if (!session) {
    return NextResponse.json(
      { error: "Sessione cliente non valida." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!hasDocumentSelection(body.documentBundle)) {
      return NextResponse.json(
        { error: "Inserisci almeno un documento prima di continuare." },
        { status: 400 }
      );
    }

    const documentBundle = normalizeShopDocumentBundle(body.documentBundle);
    const billingDetails = readBillingDetailsInput(body.billingDetails);
    const order = await createShopSalesOrder({
      customerAccountId: session.customerAccountId,
      serviceId: String(body.serviceId || ""),
      serviceLabel: String(body.serviceLabel || ""),
      quantity:
        documentBundle.totalPrintUnits ||
        parseQuantityValue(String(body.quantity || ""), 1),
      documentBundle,
      configurationSummary:
        String(body.configurationSummary || "") ||
        buildShopDocumentBundleDetailedSummary(documentBundle),
      invoiceRequested: Boolean(body.invoiceRequested),
      billingDetails,
      customerNote: String(body.customerNote || ""),
      sourcePath: String(body.sourcePath || ""),
      allowPreviewFallback: process.env.NODE_ENV !== "production"
    });

    revalidatePath("/shop");
    revalidatePath("/shop/account");
    revalidatePath(`/shop/orders/${order.id}`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      redirectPath: `/shop/orders/${order.id}`,
      salesOrderItemId: order.items[0]?.id || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: describeShopSalesOrderFailure(error) },
      { status: 400 }
    );
  }
}
