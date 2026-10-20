import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import {
  listUnreadShopSalesOrderNotifications,
  getShopNotificationRevision,
  markShopSalesOrderNotificationRead
} from "@/lib/shop-notification-inbox";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("fede_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  const revision = await getShopNotificationRevision();
  const headers = { ETag: revision, "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (request.headers.get("if-none-match") === revision) return new NextResponse(null, { status: 304, headers });
  const result = await listUnreadShopSalesOrderNotifications();
  return NextResponse.json(result, { headers });
}

export async function POST(request: NextRequest) {
  const session = readSession(request.cookies.get("fede_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { notificationId?: unknown } | null;
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId : "";
  if (!notificationId.trim()) {
    return NextResponse.json({ error: "Notifica non valida." }, { status: 400 });
  }

  await markShopSalesOrderNotificationRead(notificationId);
  return NextResponse.json({ success: true });
}
