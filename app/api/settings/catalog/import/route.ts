import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { readSession } from "@/lib/auth-core";
import { normalizeServiceCode, syncServiceCatalogEntries } from "@/lib/orders";

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseBasePriceToCents(value: unknown) {
  if (typeof value === "number") {
    return Math.max(0, Math.round(value * 100));
  }

  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    throw new Error("Prezzo base mancante.");
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error("Prezzo base non valido.");
  }

  return Math.max(0, Math.round(parsed * 100));
}

function parseActiveValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ["true", "1", "si", "sì", "yes", "y", "attivo"].includes(normalized);
}

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
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json({ error: "Il file Excel non contiene fogli validi." }, { status: 400 });
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: ""
    });

    if (!rawRows.length) {
      return NextResponse.json({ error: "Il file Excel non contiene righe dati." }, { status: 400 });
    }

    const errors: Array<{ row: number; message: string; code?: string }> = [];
    const validRows: Array<{
      code: string;
      name: string;
      description?: string;
      basePriceCents: number;
      active: boolean;
    }> = [];
    const seenCodes = new Set<string>();

    rawRows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = Object.fromEntries(
        Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value])
      );

      try {
        const code = normalizeServiceCode(String(row.code || ""));
        const name = String(row.name || "").trim();
        if (!name) {
          throw new Error("Nome servizio mancante.");
        }

        if (seenCodes.has(code)) {
          throw new Error("Codice duplicato nel file.");
        }

        seenCodes.add(code);
        validRows.push({
          code,
          name,
          description: String(row.description || "").trim() || undefined,
          basePriceCents: parseBasePriceToCents(row.base_price || row.prezzo_base),
          active: parseActiveValue(row.active)
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          code: String(row.code || "").trim() || undefined,
          message: error instanceof Error ? error.message : "Errore di import non previsto."
        });
      }
    });

    const result = await syncServiceCatalogEntries(validRows);
    revalidatePath("/settings");
    revalidatePath("/orders/new");
    return NextResponse.json({
      ...result,
      errors
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
