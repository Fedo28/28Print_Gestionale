import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_WEBHOOK_BYTES = 256 * 1024;
export function sameSecret(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return !!left.length && left.length === right.length && timingSafeEqual(left, right);
}
export function validWhatsAppSignature(bytes: Uint8Array, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return sameSecret(signature, `sha256=${createHmac("sha256", secret).update(bytes).digest("hex")}`);
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
export function parseWhatsAppMessages(payload: unknown, accountId: string, phoneNumberId: string) {
  const root = object(payload);
  if (root.object !== "whatsapp_business_account") throw Error("Evento non valido.");
  const messages: { phoneNumberId: string; providerMessageId: string; sender: string; contactName: string; kind: string;
    text: string; fileName: string | null; mimeType: string | null; mediaId: string | null; sentAt: Date }[] = [];
  for (const entry of list(root.entry)) {
    const e = object(entry);
    if (e.id !== accountId) continue;
    for (const change of list(e.changes)) {
      const c = object(change), value = object(c.value);
      if (c.field !== "messages" || object(value.metadata).phone_number_id !== phoneNumberId) continue;
      for (const item of list(value.messages)) {
        const m = object(item), kind = str(m.type, 20);
        if (!["text", "document", "image"].includes(kind)) continue;
        const id = str(m.id, 512), sender = str(m.from, 30), seconds = Number(m.timestamp);
        if (!id || !/^\d{5,20}$/.test(sender) || !Number.isSafeInteger(seconds) || seconds < 0 || seconds > 4102444800) throw Error("Messaggio non valido.");
        const media = object(m[kind]);
        const contact = list(value.contacts).map(object).find(c => c.wa_id === sender);
        const mediaId = kind === "text" ? null : str(media.id, 200);
        if (kind !== "text" && !mediaId) throw Error("Media non valido.");
        messages.push({ phoneNumberId, providerMessageId: id, sender,
          contactName: str(object(contact?.profile).name, 160) || sender, kind,
          text: str(kind === "text" ? media.body : media.caption, 4096),
          fileName: kind === "document" ? str(media.filename, 240).replace(/[\u0000-\u001f/\\]/g, "_") || "Documento" : kind === "image" ? "Immagine" : null,
          mimeType: kind === "text" ? null : str(media.mime_type, 100), mediaId, sentAt: new Date(seconds * 1000) });
        if (messages.length > 100) throw Error("Troppi messaggi.");
      }
    }
  }
  return messages;
}

export async function readWebhookBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_WEBHOOK_BYTES || !request.body) throw Error("Payload troppo grande o assente.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break;
      length += value.length; if (length > MAX_WEBHOOK_BYTES) throw Error("Payload troppo grande."); chunks.push(value); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
