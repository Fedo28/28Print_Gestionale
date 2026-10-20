import { prisma } from "@/lib/prisma";
import { whatsappWebhookConfig } from "@/lib/whatsapp-runtime";
import { parseWhatsAppMessages, readWebhookBody, sameSecret, validWhatsAppSignature } from "@/lib/whatsapp-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const config = whatsappWebhookConfig(); if (!config) return reply(404);
  const url = new URL(request.url), challenge = url.searchParams.get("hub.challenge") || "";
  if (url.searchParams.get("hub.mode") !== "subscribe" || !sameSecret(url.searchParams.get("hub.verify_token") || "", config.verifyToken) || !/^\d{1,100}$/.test(challenge)) return reply(403);
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const config = whatsappWebhookConfig(); if (!config) return reply(404);
  let bytes: Buffer;
  try { bytes = await readWebhookBody(request); } catch { return reply(413); }
  if (!validWhatsAppSignature(bytes, request.headers.get("x-hub-signature-256"), config.appSecret)) return reply(401);
  let messages: ReturnType<typeof parseWhatsAppMessages>;
  try { messages = parseWhatsAppMessages(JSON.parse(bytes.toString("utf8")), config.accountId, config.phoneNumberId); } catch { return reply(400); }
  try {
    // A single atomic INSERT with a unique provider ID handles Meta retries; never approve a PrintJob here.
    if (messages.length) await prisma.whatsAppInboundMessage.createMany({ data: messages, skipDuplicates: true });
    return reply(200);
  } catch { return reply(503); } // Retryable: do not acknowledge persistence failures or log customer payloads.
}
