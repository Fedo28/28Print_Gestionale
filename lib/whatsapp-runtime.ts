import { printEnabled } from "@/lib/print-runtime";
export function whatsappWebhookConfig() {
  if (!printEnabled() || process.env.WHATSAPP_WEBHOOK_ENABLED !== "true") return null;
  const appSecret = process.env.WHATSAPP_APP_SECRET || "", verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const accountId = process.env.WHATSAPP_TEST_ACCOUNT_ID || "", phoneNumberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID || "";
  if (appSecret.length < 16 || verifyToken.length < 32 || !/^\d+$/.test(accountId) || !/^\d+$/.test(phoneNumberId)) return null;
  return { appSecret, verifyToken, accountId, phoneNumberId };
}
