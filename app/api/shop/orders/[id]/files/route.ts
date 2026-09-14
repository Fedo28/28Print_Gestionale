import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  readCustomerAccountSession
} from "@/lib/customer-account-auth";
import {
  getShopBetaBlockedMessage,
  getShopBetaGateState,
  SHOP_BETA_ACCESS_COOKIE
} from "@/lib/shop-beta-gate";
import {
  describeShopOrderFileFailure,
  uploadCustomerShopOrderFile
} from "@/lib/shop-order-files";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const betaGate = getShopBetaGateState(request.cookies.get(SHOP_BETA_ACCESS_COOKIE)?.value);
  if (!betaGate.allowed) {
    return NextResponse.json({ error: getShopBetaBlockedMessage(betaGate) }, { status: 403 });
  }

  const session = readCustomerAccountSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione cliente non valida." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File di stampa mancante." }, { status: 400 });
    }

    const uploadResult = await uploadCustomerShopOrderFile({
      customerAccountId: session.customerAccountId,
      salesOrderId: params.id,
      salesOrderItemId: String(formData.get("salesOrderItemId") || ""),
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      buffer: Buffer.from(await file.arrayBuffer())
    });

    revalidatePath("/shop/account");
    revalidatePath(`/shop/orders/${params.id}`);

    return NextResponse.json({
      success: true,
      file: uploadResult.fileAsset,
      salesOrderItemId: uploadResult.salesOrderItemId
    });
  } catch (error) {
    const message = describeShopOrderFileFailure(error);
    const status = message === "Ordine shop non disponibile." || message === "Riga ordine shop non disponibile." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
