import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/auth-core";
import { importServiceCatalogWorkbookBuffer } from "@/lib/service-catalog-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File mancante." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importServiceCatalogWorkbookBuffer(buffer);
    revalidatePath("/settings");
    revalidatePath("/orders/new");
    return NextResponse.json({
      created: result.created,
      updated: result.updated,
      errors: result.errors
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import catalogo non riuscito."
      },
      { status: 400 }
    );
  }
}
