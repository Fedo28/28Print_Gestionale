import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth-core";
import { registerAttachment } from "@/lib/orders";

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, "_");
}

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
  const safeName = `${Date.now()}_${sanitizeFileName(file.name)}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "orders", params.id);
  const filePath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, buffer);

  const publicPath = `/uploads/orders/${params.id}/${safeName}`;
  await registerAttachment(params.id, file.name, publicPath, file.type || "application/octet-stream", file.size);

  return NextResponse.redirect(new URL(`/orders/${params.id}`, request.url), 303);
}
