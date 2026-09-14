import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { listPendingShopOnlineOperationalOrders } from "@/lib/shop-operational-orders";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("fede_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  const result = await listPendingShopOnlineOperationalOrders();
  return NextResponse.json(result);
}
