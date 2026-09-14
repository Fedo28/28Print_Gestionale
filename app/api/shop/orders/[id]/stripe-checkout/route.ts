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
  createShopStripeCheckoutSession,
  getShopStripeCheckoutAvailability
} from "@/lib/shop-payments";
import { describeShopSalesOrderFailure } from "@/lib/shop-orders";

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

  const availability = getShopStripeCheckoutAvailability();
  if (!availability.enabled) {
    return NextResponse.json(
      { error: availability.reason || "Pagamento non disponibile." },
      { status: 400 }
    );
  }

  try {
    const result = await createShopStripeCheckoutSession({
      customerAccountId: session.customerAccountId,
      requestOrigin: request.nextUrl.origin,
      salesOrderId: params.id
    });

    revalidatePath("/shop/account");
    revalidatePath(`/shop/orders/${params.id}`);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    return NextResponse.json({ error: describeShopSalesOrderFailure(error) }, { status: 400 });
  }
}
