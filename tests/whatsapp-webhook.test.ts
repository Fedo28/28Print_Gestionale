import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { MAX_WEBHOOK_BYTES, parseWhatsAppMessages, readWebhookBody, sameSecret, validWhatsAppSignature } from "../lib/whatsapp-webhook";
import { whatsappWebhookConfig } from "../lib/whatsapp-runtime";

const event = (changes: Record<string, unknown> = {}) => ({ object: "whatsapp_business_account", entry: [{ id: "123", changes: [{ field: "messages", value: {
  metadata: { phone_number_id: "456" }, contacts: [{ wa_id: "39000000000", profile: { name: "Test sintetico" } }],
  messages: [{ id: "wamid.test", from: "39000000000", timestamp: "1792159200", type: "document", document: { id: "789", filename: "../../test.pdf", mime_type: "application/pdf" }, ...changes }]
} }] }] });
afterEach(() => vi.unstubAllEnvs());
describe("WhatsApp inbound foundation", () => {
  it("verifies the raw body signature and rejects tampering", () => {
    const bytes = Buffer.from(JSON.stringify(event())); const secret = "synthetic-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(bytes).digest("hex")}`;
    expect(validWhatsAppSignature(bytes, signature, secret)).toBe(true);
    expect(validWhatsAppSignature(Buffer.concat([bytes, Buffer.from(" ")]), signature, secret)).toBe(false);
    expect(validWhatsAppSignature(bytes, null, secret)).toBe(false);
    expect(validWhatsAppSignature(bytes, "sha256=x", secret)).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });
  it("scopes every message to the configured account and phone", () => {
    expect(parseWhatsAppMessages(event(), "other", "456")).toEqual([]);
    expect(parseWhatsAppMessages(event(), "123", "other")).toEqual([]);
    expect(parseWhatsAppMessages(event(), "123", "456")[0]).toMatchObject({ providerMessageId: "wamid.test", mediaId: "789", contactName: "Test sintetico", fileName: ".._.._test.pdf" });
  });
  it("ignores unsupported kinds and rejects invalid metadata", () => {
    expect(parseWhatsAppMessages(event({ type: "location" }), "123", "456")).toEqual([]);
    expect(() => parseWhatsAppMessages(event({ timestamp: "NaN" }), "123", "456")).toThrow();
    expect(() => parseWhatsAppMessages(event({ document: {} }), "123", "456")).toThrow();
    expect(() => parseWhatsAppMessages({}, "123", "456")).toThrow();
  });
  it("bounds streamed request size even without Content-Length", async () => {
    const request = new Request("https://test.invalid", { method: "POST", body: "a".repeat(MAX_WEBHOOK_BYTES + 1) });
    await expect(readWebhookBody(request)).rejects.toThrow(/grande/);
  });
  it("requires explicit complete test configuration and never activates in production", () => {
    vi.stubEnv("PRINT_BRIDGE_ENABLED", "true"); vi.stubEnv("PRINT_BRIDGE_ENVIRONMENT", "test"); vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("WHATSAPP_WEBHOOK_ENABLED", "false"); expect(whatsappWebhookConfig()).toBeNull();
    vi.stubEnv("WHATSAPP_WEBHOOK_ENABLED", "true"); vi.stubEnv("WHATSAPP_APP_SECRET", "s".repeat(32)); vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "v".repeat(32));
    vi.stubEnv("WHATSAPP_TEST_ACCOUNT_ID", "123"); vi.stubEnv("WHATSAPP_TEST_PHONE_NUMBER_ID", "456");
    expect(whatsappWebhookConfig()).not.toBeNull(); vi.stubEnv("VERCEL_ENV", "production"); expect(whatsappWebhookConfig()).toBeNull();
  });
});
