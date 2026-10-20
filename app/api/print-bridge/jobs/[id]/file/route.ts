import { authenticateBridge, getPrintDownload } from "@/lib/print-jobs";
import { assertPrintTransport } from "@/lib/print-runtime";
import { isUuid } from "@/bridge/src/protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    assertPrintTransport(request);
    const bridgeId = await authenticateBridge(request.headers.get("authorization"));
    const lease = request.headers.get("x-print-lease");
    if (!isUuid(params.id) || !isUuid(lease)) return new Response(null, { status: 400 });
    const bytes = await getPrintDownload(bridgeId, params.id, lease);
    // Stream the verified bytes; no redirect to a public storage URL and no buffered function response.
    let offset = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + 65536)); offset += 65536;
    } }), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Documento non disponibile o revisione non valida.", { status: 403 }); }
}
