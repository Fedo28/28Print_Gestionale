import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { searchGlobal } from "@/lib/global-search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  const scope = request.nextUrl.searchParams.get("scope");
  const sections = (await searchGlobal(query)).filter((section) => {
    if (scope === "records") {
      return section.key === "orders" || section.key === "customers";
    }

    if (scope === "catalog") {
      return section.key === "services";
    }

    return true;
  });

  return NextResponse.json({
    sections
  });
}
