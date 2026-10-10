import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processSiteEmailReminders } from "@/lib/site-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (secret.length < 16 || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  try { return NextResponse.json(await processSiteEmailReminders(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Controllo email non completato. Verifica lo storico degli avvisi." }, { status: 500 }); }
}
