import { afterEach, describe, expect, it, vi } from "vitest";
import { blankSiteService } from "../lib/managed-sites-domain";
import type { ManagedSiteRecord } from "../lib/managed-sites-domain";
import { defaultSiteEmailSettings, parseSiteEmailSettings, renderSiteReminder, SITE_EMAIL_ADDRESS, SITE_EMAIL_FROM, siteReminderEligibility, validateSiteEmailSettings } from "../lib/site-email-domain";
import { sendTextEmail } from "../lib/mail";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const today = "2026-10-09";
const row = (): ManagedSiteRecord => ({ id: "site", hostname: "example.it", name: "", customerId: "customer", customer: { id: "customer", name: "Atlas", email: "customer@example.invalid" }, domainRenewalMode: "UNKNOWN", notes: "Non inviare queste note", version: 0, archivedAt: null,
  emailRemindersEnabled: true, renewalEmail: null, services: [{ ...blankSiteService, id: "hosting", kind: "HOSTING", version: 0, renewals: [], renewalDay: 20, renewalMonth: 10, renewalYear: 2026, costCents: 14999 }] });

describe("site email reminders", () => {
  it("uses the requested sender and reply address without exposing provider costs or internal notes", () => {
    const site = row(); const message = renderSiteReminder(site, site.services[0], defaultSiteEmailSettings);
    expect(message.from).toBe("28 Print <info@28print.it>"); expect(message.replyTo).toBe(SITE_EMAIL_ADDRESS);
    expect(message.text).toContain("20/10/2026"); expect(message.text).toContain("example.it");
    expect(message.text).not.toContain("149"); expect(message.text).not.toContain(site.notes); expect(message.text).not.toContain("confermare il rinnovo");
  });
  it("requires opt-in, a customer, a valid email and a fully confirmed due date", () => {
    const site = row();
    expect(siteReminderEligibility(site, site.services[0], today, 30).eligible).toBe(true);
    for (const changes of [{ emailRemindersEnabled: false }, { customerId: null }, { customer: null }, { customer: { id: "customer", name: "Atlas", email: "bad" } }, { archivedAt: today }]) expect(siteReminderEligibility({ ...site, ...changes }, site.services[0], today, 30).eligible).toBe(false);
    expect(siteReminderEligibility(site, { ...site.services[0], renewalYear: null }, today, 30).eligible).toBe(false);
  });
  it("handles a missed first check inside the reminder window and excludes overdue dates", () => {
    const site = row();
    expect(siteReminderEligibility(site, site.services[0], "2026-09-20", 30).eligible).toBe(true);
    expect(siteReminderEligibility(site, site.services[0], "2026-09-19", 30).eligible).toBe(false);
    expect(siteReminderEligibility(site, site.services[0], "2026-10-20", 30).eligible).toBe(true);
    expect(siteReminderEligibility(site, site.services[0], "2026-10-21", 30).eligible).toBe(false);
  });
  it("uses a dedicated contact only for an associated customer", () => {
    const site = row(); site.renewalEmail = " renewals@example.invalid ";
    expect(siteReminderEligibility(site, site.services[0], today, 30).recipient).toBe("renewals@example.invalid");
    site.customerId = null; expect(siteReminderEligibility(site, site.services[0], today, 30).eligible).toBe(false);
  });
  it("only includes a domain separately when its renewal is independent", () => {
    const site = row(); const domain = { ...site.services[0], id: "domain", kind: "DOMAIN" as const }; site.services.push(domain); site.domainRenewalMode = "TOGETHER";
    expect(siteReminderEligibility(site, domain, today, 30).eligible).toBe(false);
    expect(renderSiteReminder(site, site.services[0], defaultSiteEmailSettings).text).toContain("hosting e dominio");
    site.domainRenewalMode = "SEPARATE"; expect(siteReminderEligibility(site, domain, today, 30).eligible).toBe(true);
  });
  it("rejects unsupported template variables and falls back disabled on corrupt configuration", () => {
    expect(() => validateSiteEmailSettings({ ...defaultSiteEmailSettings, text: "Prezzo {costCents}" })).toThrow(/Variabile/);
    expect(() => validateSiteEmailSettings({ ...defaultSiteEmailSettings, subject: "test\nBCC: other@example.invalid" })).toThrow();
    expect(parseSiteEmailSettings('{"enabled":true}').enabled).toBe(false);
    const site = row(); site.customer!.name = "Atlas\nAltro";
    expect(renderSiteReminder(site, site.services[0], { ...defaultSiteEmailSettings, subject: "Avviso {cliente}" }).subject).toBe("Avviso Atlas Altro");
  });
});

describe("email delivery", () => {
  const input = { to: "customer@example.invalid", from: SITE_EMAIL_FROM, replyTo: SITE_EMAIL_ADDRESS, subject: "Prova", text: "Testo", idempotencyKey: "reminder/test-1" };
  it("never sends from the local preview even when a key is present", async () => {
    vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "true"); vi.stubEnv("RESEND_API_KEY", "fake-key"); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await sendTextEmail(input)).sent).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends the fixed sender and idempotency key and keeps the provider reference", async () => {
    vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "false"); vi.stubEnv("RESEND_API_KEY", "fake-key"); vi.stubEnv("MAIL_FROM", "");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-123" }), { status: 200 })); vi.stubGlobal("fetch", fetcher);
    expect(await sendTextEmail(input)).toMatchObject({ sent: true, providerId: "provider-123" });
    expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(input.idempotencyKey);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ from: SITE_EMAIL_FROM, reply_to: SITE_EMAIL_ADDRESS, to: [input.to] });
  });
  it("quarantines timeouts and ambiguous responses instead of assuming an email failed", async () => {
    vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "false"); vi.stubEnv("RESEND_API_KEY", "fake-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await sendTextEmail(input)).toMatchObject({ sent: false, ambiguous: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad response", { status: 200 })));
    expect(await sendTextEmail(input)).toMatchObject({ sent: false, ambiguous: true });
  });
  it("redacts the provider key from rejected request details", async () => {
    vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "false"); vi.stubEnv("RESEND_API_KEY", "fake-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid fake-key", { status: 403 })));
    const result = await sendTextEmail(input); expect(result).toMatchObject({ sent: false, ambiguous: false }); expect(result.message).not.toContain("fake-key");
  });
});
