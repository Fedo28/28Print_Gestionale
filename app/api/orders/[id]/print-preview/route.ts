import { requireAuth } from "@/lib/auth";
import { reviewPrintAttachment } from "@/lib/print-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  try {
    const url = new URL(request.url);
    const reviewed = await reviewPrintAttachment(session.userId, params.id, url.searchParams.get("attachment") || "");
    if (url.searchParams.get("sha256") !== reviewed.sha256) return new Response("Il PDF è cambiato: riapri l'anteprima.", { status: 409 });
    return new Response(new Uint8Array(reviewed.bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=anteprima.pdf",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
    } });
  } catch { return new Response("Anteprima non disponibile.", { status: 403, headers: { "Cache-Control": "no-store" } }); }
}
