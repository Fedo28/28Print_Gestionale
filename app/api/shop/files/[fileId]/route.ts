import { NextRequest, NextResponse } from "next/server";
import { sanitizeAttachmentFileName } from "@/lib/attachment-utils";
import {
  CUSTOMER_SESSION_COOKIE,
  readCustomerAccountSession
} from "@/lib/customer-account-auth";
import {
  getShopBetaBlockedMessage,
  getShopBetaGateState,
  SHOP_BETA_ACCESS_COOKIE
} from "@/lib/shop-beta-gate";
import {
  describeShopOrderFileFailure,
  readCustomerShopOrderFile
} from "@/lib/shop-order-files";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { fileId: string } }) {
  const betaGate = getShopBetaGateState(request.cookies.get(SHOP_BETA_ACCESS_COOKIE)?.value);
  if (!betaGate.allowed) {
    return NextResponse.json({ error: getShopBetaBlockedMessage(betaGate) }, { status: 403 });
  }

  const session = readCustomerAccountSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessione cliente non valida." }, { status: 401 });
  }

  try {
    const { buffer, fileAsset } = await readCustomerShopOrderFile(params.fileId, session.customerAccountId);
    const safeFileName = sanitizeAttachmentFileName(fileAsset.originalName);
    const encodedFileName = encodeURIComponent(fileAsset.originalName);

    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": String(buffer.byteLength),
        "Content-Type": fileAsset.mimeType || "application/octet-stream"
      }
    });
  } catch (error) {
    const message = describeShopOrderFileFailure(error);
    const status = message === "Ordine shop non disponibile." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
