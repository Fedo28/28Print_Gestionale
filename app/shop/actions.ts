"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearCustomerAccountSession, createCustomerAccountSession } from "@/lib/customer-account-auth";
import { clearShopBetaAccess, grantShopBetaAccess } from "@/lib/shop-beta-gate";
import {
  authenticateCustomerAccount,
  describeCustomerAccountFailure,
  registerCustomerAccount,
  validateCustomerAccountPassword
} from "@/lib/customer-accounts";
import { createShopSalesOrder, describeShopSalesOrderFailure } from "@/lib/shop-orders";
import { parseQuantityValue } from "@/lib/pricing";
import { requireCustomerAccountAuth } from "@/lib/customer-account-auth";
import {
  buildShopDocumentBundleDetailedSummary,
  normalizeShopPrintConfiguration,
  parseShopDocumentBundlePayload
} from "@/lib/shop-print-config";

export type ShopAuthActionState = {
  error: string | null;
};

export type ShopOrderActionState = {
  error: string | null;
};

export type ShopBetaAccessActionState = {
  error: string | null;
};

export async function unlockShopBetaAccessAction(
  _: ShopBetaAccessActionState,
  formData: FormData
): Promise<ShopBetaAccessActionState> {
  try {
    grantShopBetaAccess(String(formData.get("accessCode") || ""));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Codice beta non valido."
    };
  }

  redirect("/shop");
}

export async function lockShopBetaAccessAction() {
  clearShopBetaAccess();
  redirect("/shop");
}

export async function loginCustomerAccountAction(
  _: ShopAuthActionState,
  formData: FormData
): Promise<ShopAuthActionState> {
  try {
    const account = await authenticateCustomerAccount({
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || "")
    });

    createCustomerAccountSession({
      customerAccountId: account.id,
      customerId: account.customerId,
      email: account.emailNormalized
    });
  } catch (error) {
    return {
      error: describeCustomerAccountFailure(error)
    };
  }

  redirect("/shop/account");
}

export async function registerCustomerAccountAction(
  _: ShopAuthActionState,
  formData: FormData
): Promise<ShopAuthActionState> {
  try {
    const password = validateCustomerAccountPassword(String(formData.get("password") || ""));
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      throw new Error("Le password non coincidono.");
    }

    const account = await registerCustomerAccount({
      fullName: String(formData.get("fullName") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      password
    });

    createCustomerAccountSession({
      customerAccountId: account.id,
      customerId: account.customerId,
      email: account.emailNormalized
    });
  } catch (error) {
    return {
      error: describeCustomerAccountFailure(error)
    };
  }

  redirect("/shop/account");
}

export async function logoutCustomerAccountAction() {
  clearCustomerAccountSession();
  redirect("/shop");
}

export async function createShopSalesOrderAction(
  _: ShopOrderActionState,
  formData: FormData
): Promise<ShopOrderActionState> {
  const session = await requireCustomerAccountAuth();

  try {
    const documentBundle = parseShopDocumentBundlePayload(String(formData.get("documentBundle") || ""));
    const configuration = normalizeShopPrintConfiguration({
      format: String(formData.get("format") || ""),
      colorMode: String(formData.get("colorMode") || ""),
      sidesMode: String(formData.get("sidesMode") || ""),
      paperType: String(formData.get("paperType") || ""),
      paperStock: String(formData.get("paperStock") || ""),
      binding: String(formData.get("binding") || "")
    });
    const order = await createShopSalesOrder({
      customerAccountId: session.customerAccountId,
      serviceId: String(formData.get("serviceId") || ""),
      serviceLabel: String(formData.get("serviceLabel") || ""),
      quantity: documentBundle?.totalPrintUnits || parseQuantityValue(String(formData.get("quantity") || ""), 1),
      documentBundle,
      configuration,
      configurationSummary:
        String(formData.get("configurationSummary") || "") || (documentBundle ? buildShopDocumentBundleDetailedSummary(documentBundle) : ""),
      invoiceRequested: String(formData.get("invoiceRequested") || "") === "on",
      customerNote: String(formData.get("customerNote") || ""),
      sourcePath: String(formData.get("sourcePath") || ""),
      allowPreviewFallback: process.env.NODE_ENV !== "production"
    });

    revalidatePath("/shop");
    revalidatePath("/shop/account");
    revalidatePath(`/shop/orders/${order.id}`);
    redirect(`/shop/orders/${order.id}`);
  } catch (error) {
    return {
      error: describeShopSalesOrderFailure(error)
    };
  }
}
