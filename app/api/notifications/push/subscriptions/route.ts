import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import {
  disableStaffPushSubscription,
  getStaffPushClientConfig,
  parseStaffPushSubscriptionInput,
  registerStaffPushSubscription
} from "@/lib/push-notifications";

export const runtime = "nodejs";

function readStaffSession(request: NextRequest) {
  return readSession(request.cookies.get("fede_session")?.value);
}

export async function POST(request: NextRequest) {
  const session = readStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  const config = getStaffPushClientConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: config.reason || "Push non configurate." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { subscription?: unknown } | null;
  const subscription = parseStaffPushSubscriptionInput(body?.subscription);
  if (!subscription) {
    return NextResponse.json({ error: "Iscrizione push non valida." }, { status: 400 });
  }

  await registerStaffPushSubscription({
    subscription,
    userAgent: request.headers.get("user-agent"),
    userId: session.userId
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = readStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint.trim()) {
    return NextResponse.json({ error: "Endpoint push mancante." }, { status: 400 });
  }

  await disableStaffPushSubscription({
    endpoint,
    userId: session.userId
  });

  return NextResponse.json({ success: true });
}
