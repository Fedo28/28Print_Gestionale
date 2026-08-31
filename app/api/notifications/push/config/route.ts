import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { getStaffPushClientConfig } from "@/lib/push-notifications";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("fede_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione gestionale non valida." }, { status: 401 });
  }

  return NextResponse.json(getStaffPushClientConfig());
}
