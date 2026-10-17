import { NextResponse } from "next/server";
import { authenticateBridge, beginPrintDispatch, claimPrintJob, renewPrintLease, reportPrintJob } from "@/lib/print-jobs";
import { assertPrintTransport } from "@/lib/print-runtime";
import { isUuid } from "@/bridge/src/protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertPrintTransport(request);
    let bridgeId: string;
    try { bridgeId = await authenticateBridge(request.headers.get("authorization")); }
    catch { return NextResponse.json({ error: "Bridge non autorizzato." }, { status: 401 }); }
    if (Number(request.headers.get("content-length") || 0) > 16384) return new Response(null, { status: 413 });
    const text = await request.text();
    if (text.length > 16384) return new Response(null, { status: 413 });
    const body = JSON.parse(text);
    if (body.operation === "claim") {
      if (!Array.isArray(body.destinations) || !body.destinations.every((key: unknown) => typeof key === "string")) throw new Error("Destinazioni non valide.");
      return NextResponse.json({ job: await claimPrintJob(bridgeId, body.destinations) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!isUuid(body.jobId) || !isUuid(body.claimToken)) throw new Error("Identificativi non validi.");
    if (body.operation === "renew") await renewPrintLease(bridgeId, body.jobId, body.claimToken);
    else if (body.operation === "begin" && isUuid(body.dispatchId)) await beginPrintDispatch(bridgeId, body.jobId, body.claimToken, body.dispatchId);
    else if (body.operation === "report" && ["DELIVERED", "ERROR", "NEEDS_REVIEW"].includes(body.outcome) && typeof body.detail === "string" && (!body.dispatchId || isUuid(body.dispatchId))) {
      await reportPrintJob(bridgeId, body);
    } else throw new Error("Operazione non valida.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    // No database internals, tokens or source URLs in HTTP errors.
    const message = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Operazione Bridge non disponibile.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
