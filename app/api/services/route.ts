import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { parseCurrencyToCents } from "@/lib/forms";
import { createService, setServiceCatalogEntryActive } from "@/lib/orders";
import { parseServiceUnit } from "@/lib/service-units";

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
      parseServiceUnit(body.unit),
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

export async function PATCH(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const active = body.active === true;

    if (!id) {
      return NextResponse.json({ error: "Servizio non valido." }, { status: 400 });
    }

    const service = await setServiceCatalogEntryActive(id, active);

    revalidatePath("/settings");
    revalidatePath("/orders/new");
    revalidatePath("/quotes/new");

    return NextResponse.json({ service });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Aggiornamento servizio non riuscito."
      },
      { status: 400 }
    );
  }
}
