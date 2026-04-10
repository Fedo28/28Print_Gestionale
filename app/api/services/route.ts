import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { parseCurrencyToCents } from "@/lib/forms";
import { createService } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = await createService(
      String(body.code || ""),
      String(body.name || ""),
      String(body.description || "") || undefined,
      parseCurrencyToCents(String(body.basePrice || "")),
      String(body.quantityTiers || "")
    );

    revalidatePath("/settings");
    revalidatePath("/orders/new");
    revalidatePath("/quotes/new");

    return NextResponse.json({ service });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Creazione servizio non riuscita."
      },
      { status: 400 }
    );
  }
}
