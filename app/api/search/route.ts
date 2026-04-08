import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { searchGlobal } from "@/lib/global-search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  const sections = await searchGlobal(query);

  return NextResponse.json({
    sections
  });
}
