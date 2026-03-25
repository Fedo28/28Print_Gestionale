import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { registerAttachment } from "@/lib/orders";
import { deleteStoredAttachment, uploadOrderAttachment } from "@/lib/storage";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!readSession(request.cookies.get("fede_session")?.value)) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File mancante." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const stored = await uploadOrderAttachment({
    orderId: params.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer
  });

  try {
    await registerAttachment(params.id, file.name, stored.filePath, file.type || "application/octet-stream", file.size);
  } catch (error) {
    await deleteStoredAttachment(stored.filePath).catch(() => undefined);
    throw error;
  }

  return NextResponse.redirect(new URL(`/orders/${params.id}`, request.url), 303);
}
