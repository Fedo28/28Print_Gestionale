import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { getWhatsappLink } from "@/lib/orders";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  try {
    const whatsappUrl = await getWhatsappLink(params.id, { requireReady: true });
    return NextResponse.json({ whatsappUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Errore inatteso."
      },
      { status: 400 }
    );
  }
}
