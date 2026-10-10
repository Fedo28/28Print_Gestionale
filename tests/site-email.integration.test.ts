import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { getSiteEmailSettings, processSiteEmailReminders, retrySiteEmailReminder, saveSiteEmailSettings, sendSiteEmailTest } from "../lib/site-email";
import { blankSiteService } from "../lib/managed-sites-domain";
import { defaultSiteEmailSettings, SITE_EMAIL_FROM } from "../lib/site-email-domain";
import { recordSiteRenewal, saveManagedSite, managedSiteInclude, serializeManagedSite } from "../lib/managed-sites";
import type { ManagedSiteInput } from "../lib/managed-sites-domain";
import type { SiteEmailSettings } from "../lib/site-email-domain";
import type { TextEmailInput } from "../lib/mail";

const databaseUrl = process.env.SITE_EMAIL_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/fede_personal_preview" || process.env.DATABASE_URL !== databaseUrl) throw new Error("I test email richiedono la sola copia locale dell’anteprima.");
}
describe.runIf(Boolean(databaseUrl))("site email integration (mock delivery only)", () => {
  const admin = randomUUID(), operator = randomUUID(), customerId = randomUUID();
  const createdIds: string[] = [];
  const keys = ["siteRenewalEmailSettings", "siteRenewalEmailLastTest"];
  const originals = new Map<string, string | null>();
  const written = new Map<string, Set<string>>(keys.map(key => [key, new Set()]));
  const fakeKey = `fake-no-delivery-${randomUUID()}`;
  const keyHash = createHash("sha256").update(fakeKey).digest("hex");
  const now = new Date("2026-10-09T12:00:00Z");
  const accepted = () => vi.fn(async (_input: TextEmailInput) => ({ sent: true, providerId: `mock-${randomUUID()}`, message: "Consegna simulata" }));
  const saveSettings = async (value: SiteEmailSettings) => { const saved = await saveSiteEmailSettings(admin, value); written.get(keys[0])!.add(JSON.stringify(saved)); return saved; };
  const testSettings = async (value: SiteEmailSettings) => {
    await sendSiteEmailTest(admin, "tester@example.invalid", value, accepted());
    const row = await prisma.appSetting.findUniqueOrThrow({ where: { key: keys[1] } });
    if (JSON.parse(row.value).keyHash === keyHash) written.get(keys[1])!.add(row.value);
  };
  const create = async (changes: Partial<ManagedSiteInput> = {}) => {
    const row = await saveManagedSite(admin, { hostname: `site-mail-test-${randomUUID()}.invalid`, name: "[Verifica email] Sito", customerId, domainRenewalMode: "UNKNOWN", notes: "", emailRemindersEnabled: true,
      hosting: { ...blankSiteService, renewalDay: 20, renewalMonth: 10, renewalYear: 2026 }, domain: null, ...changes }); createdIds.push(row.id); return row;
  };

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "false"); vi.stubEnv("RESEND_API_KEY", fakeKey); vi.stubEnv("CRON_SECRET", "fake-cron-secret-minimum-16"); vi.stubEnv("SITE_RENEWAL_EMAILS_ENABLED", "true");
    for (const key of keys) originals.set(key, (await prisma.appSetting.findUnique({ where: { key } }))?.value || null);
    for (const [id, role] of [[admin, "ADMIN"], [operator, "OPERATOR"]] as const) await prisma.user.create({ data: { id, name: "[Verifica email] Profilo", nickname: `mail-${id}`, email: `${id}@example.invalid`, passwordHash: "not-used", role } });
    await prisma.customer.create({ data: { id: customerId, name: "[Verifica email] Cliente", email: "recipient@example.invalid" } });
    const base = await getSiteEmailSettings();
    const draft = await saveSettings({ ...defaultSiteEmailSettings, version: base.version, subject: "[Verifica email] {sito}" });
    await testSettings(draft); await saveSettings({ ...draft, enabled: true });
  });
  afterAll(async () => {
    await prisma.managedSite.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { id: { in: [admin, operator] } } });
    for (const key of keys) {
      const current = await prisma.appSetting.findUnique({ where: { key } });
      if (current && written.get(key)!.has(current.value)) {
        const original = originals.get(key);
        if (original === null) await prisma.appSetting.deleteMany({ where: { key, value: current.value } });
        else if (original !== undefined) await prisma.appSetting.updateMany({ where: { key, value: current.value }, data: { value: original } });
      }
    }
    vi.unstubAllEnvs(); vi.useRealTimers(); await prisma.$disconnect();
  });

  it("sends once for a cycle even with repeated and concurrent daily checks", async () => {
    const site = await create(); const mailer = accepted();
    await Promise.all([processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer }), processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer })]);
    await processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer });
    expect(mailer).toHaveBeenCalledTimes(1);
    expect(mailer.mock.calls[0][0]).toMatchObject({ from: SITE_EMAIL_FROM, replyTo: "info@28print.it", to: "recipient@example.invalid" });
    expect(await prisma.siteEmailReminder.count({ where: { serviceId: site.services[0].id, status: "SENT" } })).toBe(1);
  });
  it("excludes opt-outs, unconfirmed years and unassigned sites", async () => {
    const sites = await Promise.all([create({ emailRemindersEnabled: false }), create({ customerId: null }), create({ hosting: { ...blankSiteService, renewalDay: 20, renewalMonth: 10 } })]);
    const mailer = accepted(); await processSiteEmailReminders({ now, siteIds: sites.map(site => site.id), pauseMs: 0, mailer });
    expect(mailer).not.toHaveBeenCalled();
  });
  it("only sends the hosting notice when the domain is part of the same renewal", async () => {
    const site = await create({ domainRenewalMode: "TOGETHER", domain: { ...blankSiteService, renewalDay: 20, renewalMonth: 10, renewalYear: 2026 } });
    const mailer = accepted(); await processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer });
    expect(mailer).toHaveBeenCalledTimes(1); expect(mailer.mock.calls[0][0].text).toContain("hosting e dominio");
  });
  it("starts a new cycle only after the renewed deadline reaches its reminder window", async () => {
    const site = await create(); const mailer = accepted();
    await processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer });
    const current = serializeManagedSite(await prisma.managedSite.findUniqueOrThrow({ where: { id: site.id }, include: managedSiteInclude }));
    await recordSiteRenewal(admin, { siteId: site.id, siteVersion: current.version, serviceId: current.services[0].id, serviceVersion: current.services[0].version, renewedOn: "2026-10-09", nextDueDate: "2027-10-20", costCents: null, note: "Verifica nuovo ciclo" });
    await processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer }); expect(mailer).toHaveBeenCalledTimes(1);
    await processSiteEmailReminders({ now: new Date("2027-10-01T12:00:00Z"), siteIds: [site.id], pauseMs: 0, mailer }); expect(mailer).toHaveBeenCalledTimes(2);
  });
  it("does not resend an ambiguous result and allows a deliberate retry only for definite rejection", async () => {
    const uncertain = await create(); const ambiguous = vi.fn(async () => ({ sent: false, ambiguous: true, message: "timeout simulato" }));
    await processSiteEmailReminders({ now, siteIds: [uncertain.id], pauseMs: 0, mailer: ambiguous });
    await processSiteEmailReminders({ now, siteIds: [uncertain.id], pauseMs: 0, mailer: ambiguous }); expect(ambiguous).toHaveBeenCalledTimes(1);
    const unknown = await prisma.siteEmailReminder.findFirstOrThrow({ where: { serviceId: uncertain.services[0].id } });
    await expect(retrySiteEmailReminder(admin, unknown.id, accepted())).rejects.toThrow(/non è ritentabile/);
    const rejected = await create(); await processSiteEmailReminders({ now, siteIds: [rejected.id], pauseMs: 0, mailer: async () => ({ sent: false, message: "rifiuto simulato" }) });
    const failed = await prisma.siteEmailReminder.findFirstOrThrow({ where: { serviceId: rejected.services[0].id } });
    const mailer = accepted(); expect(await retrySiteEmailReminder(admin, failed.id, mailer)).toBe("sent");
    expect(mailer).toHaveBeenCalledTimes(1); expect(mailer.mock.calls[0][0].idempotencyKey).toContain("/2");
  });
  it("blocks disabled environments without claiming or sending messages", async () => {
    const site = await create(); const mailer = accepted(); vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "true");
    try { expect((await processSiteEmailReminders({ now, siteIds: [site.id], pauseMs: 0, mailer })).blocked).toBe(true); expect(mailer).not.toHaveBeenCalled(); }
    finally { vi.stubEnv("GESTIONALE_LOCAL_PREVIEW", "false"); }
    expect(await prisma.siteEmailReminder.count({ where: { serviceId: site.services[0].id } })).toBe(0);
  });
  it("protects configuration and testing from operators and requires a matching test after template changes", async () => {
    const current = await getSiteEmailSettings();
    await expect(saveSiteEmailSettings(operator, current)).rejects.toThrow(/amministratore/);
    await expect(sendSiteEmailTest(operator, "tester@example.invalid", current, accepted())).rejects.toThrow(/amministratore/);
    await expect(saveSiteEmailSettings(admin, { ...current, text: `${current.text}\nTesto modificato` })).rejects.toThrow(/prova/);
  });
});
