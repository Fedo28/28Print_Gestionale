import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateKey } from "@/lib/format";
import { sendTextEmail } from "@/lib/mail";
import type { TextEmailInput, TextEmailDeliveryResult } from "@/lib/mail";
import { managedSiteInclude, serializeManagedSite } from "@/lib/managed-sites";
import { getSiteServicesToMonitor } from "@/lib/managed-sites-domain";
import { defaultSiteEmailSettings, isSiteContactEmail, parseSiteEmailSettings, renderSiteReminder, SITE_EMAIL_ADDRESS, SITE_EMAIL_FROM, siteReminderEligibility, validateSiteEmailSettings } from "@/lib/site-email-domain";
import type { SiteEmailSettings } from "@/lib/site-email-domain";

const SETTINGS_KEY = "siteRenewalEmailSettings";
const TEST_KEY = "siteRenewalEmailLastTest";
type Mailer = (input: TextEmailInput) => Promise<TextEmailDeliveryResult>;
type TestStamp = { recipient: string; testedAt: string; templateHash: string; keyHash: string };
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
const templateHash = (settings: SiteEmailSettings) => fingerprint(`${SITE_EMAIL_FROM}\n${settings.subject}\n${settings.text}`);

export function getSiteEmailRuntime() {
  const local = process.env.GESTIONALE_LOCAL_PREVIEW === "true" || process.env.NODE_ENV !== "production";
  const providerConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const cronConfigured = (process.env.CRON_SECRET?.trim().length || 0) >= 16;
  const liveAllowed = process.env.SITE_RENEWAL_EMAILS_ENABLED === "true";
  return { local, providerConfigured, cronConfigured, liveAllowed, canSend: !local && providerConfigured && cronConfigured && liveAllowed };
}

async function assertEmailAdmin(userId: string) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { active: true, role: true } });
  if (!actor?.active || actor.role !== "ADMIN") throw new Error("Solo un amministratore può configurare o inviare gli avvisi email.");
}

export async function getSiteEmailSettings() { return parseSiteEmailSettings((await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } }))?.value); }
async function getTestStamp(): Promise<TestStamp | null> {
  try { const row = await prisma.appSetting.findUnique({ where: { key: TEST_KEY } }); return row ? JSON.parse(row.value) : null; } catch { return null; }
}
function matchesTest(stamp: TestStamp | null, settings: SiteEmailSettings) {
  return Boolean(stamp && stamp.templateHash === templateHash(settings) && stamp.keyHash === fingerprint(process.env.RESEND_API_KEY?.trim() || ""));
}
export async function getSiteEmailDashboard() {
  const [settings, stamp, history] = await Promise.all([
    getSiteEmailSettings(), getTestStamp(), prisma.siteEmailReminder.findMany({ take: 30, orderBy: { createdAt: "desc" },
      select: { id: true, dueDate: true, status: true, recipient: true, subject: true, sentAt: true, createdAt: true, error: true, service: { select: { kind: true, site: { select: { hostname: true } } } } } })
  ]);
  return { settings, runtime: getSiteEmailRuntime(), testMatches: matchesTest(stamp, settings),
    lastTest: stamp ? { recipient: stamp.recipient, testedAt: stamp.testedAt } : null,
    history: history.map(row => ({ id: row.id, hostname: row.service.site.hostname, kind: row.service.kind, dueDate: row.dueDate, status: row.status, recipient: row.recipient, subject: row.subject, sentAt: row.sentAt?.toISOString() || null, createdAt: row.createdAt.toISOString(), error: row.error })) };
}
export type SiteEmailDashboard = Awaited<ReturnType<typeof getSiteEmailDashboard>>;

export async function saveSiteEmailSettings(userId: string, raw: SiteEmailSettings) {
  await assertEmailAdmin(userId);
  const input = validateSiteEmailSettings(raw);
  if (input.enabled && (!getSiteEmailRuntime().canSend || !matchesTest(await getTestStamp(), input))) throw new Error("Completa la configurazione dell’invio e manda una prova con questo testo prima di attivare le mail automatiche.");
  return prisma.$transaction(async tx => {
    const row = await tx.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const current = parseSiteEmailSettings(row?.value);
    if (current.version !== input.version) throw new Error("Le impostazioni sono state aggiornate da un collega. Ricarica prima di salvarle.");
    const saved = { ...input, version: current.version + 1 };
    if (row) {
      const changed = await tx.appSetting.updateMany({ where: { key: SETTINGS_KEY, value: row.value }, data: { value: JSON.stringify(saved) } });
      if (!changed.count) throw new Error("Le impostazioni sono state aggiornate da un collega.");
    } else {
      try { await tx.appSetting.create({ data: { key: SETTINGS_KEY, value: JSON.stringify(saved) } }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Le impostazioni sono state aggiornate da un collega."); throw error; }
    }
    return saved;
  });
}

export async function sendSiteEmailTest(userId: string, recipient: string, raw: SiteEmailSettings, mailer: Mailer = sendTextEmail) {
  await assertEmailAdmin(userId);
  const settings = validateSiteEmailSettings(raw);
  const to = recipient.trim();
  if (!isSiteContactEmail(to)) throw new Error("Inserisci un indirizzo valido per la prova.");
  if (!getSiteEmailRuntime().canSend) throw new Error("Invio non configurato. Nell’anteprima locale puoi verificare il testo senza spedire email.");
  const render = (text: string) => text.replace(/\{cliente\}/g, "Cliente di prova").replace(/\{sito\}/g, "sito-di-prova.it").replace(/\{servizio\}/g, "web hosting").replace(/\{scadenza\}/g, "20/10/2027");
  const result = await mailer({ to, from: SITE_EMAIL_FROM, replyTo: SITE_EMAIL_ADDRESS, subject: `[PROVA] ${render(settings.subject)}`, text: `${render(settings.text)}\n\nQuesta è una prova del modello: non riguarda una scadenza reale.` });
  if (!result.sent) throw new Error(result.message);
  await prisma.appSetting.upsert({ where: { key: TEST_KEY }, create: { key: TEST_KEY, value: "" }, update: {} });
  await prisma.appSetting.update({ where: { key: TEST_KEY }, data: { value: JSON.stringify({ recipient: to, testedAt: new Date().toISOString(), templateHash: templateHash(settings), keyHash: fingerprint(process.env.RESEND_API_KEY?.trim() || "") } satisfies TestStamp) } });
  return { recipient: to, testedAt: new Date().toISOString() };
}

async function claimReminder(siteId: string, serviceId: string, today: string, settings: SiteEmailSettings, retryId?: string) {
  return prisma.$transaction(async tx => {
    // Lock the site while claiming the cycle; never hold a DB transaction across an email request.
    await tx.$queryRaw`SELECT "id" FROM "ManagedSite" WHERE "id" = ${siteId} FOR UPDATE`;
    const raw = await tx.managedSite.findUnique({ where: { id: siteId }, include: managedSiteInclude });
    if (!raw) return null;
    const site = serializeManagedSite(raw), service = site.services.find(item => item.id === serviceId);
    if (!service) return null;
    const eligibility = siteReminderEligibility(site, service, today, settings.leadDays);
    if (!eligibility.eligible) return null;
    const existing = await tx.siteEmailReminder.findUnique({ where: { serviceId_dueDate: { serviceId, dueDate: eligibility.dueDate! } } });
    const message = renderSiteReminder(site, service, settings);
    const data = { status: "SENDING" as const, recipient: eligibility.recipient!, sender: SITE_EMAIL_FROM, subject: message.subject, text: message.text, error: "", startedAt: new Date(), providerId: null, sentAt: null };
    if (existing) {
      if (existing.status === "CANCELLED" || (retryId === existing.id && existing.status === "FAILED")) return tx.siteEmailReminder.update({ where: { id: existing.id }, data: { ...data, attempts: { increment: 1 } } });
      return null;
    }
    if (retryId) return null;
    return tx.siteEmailReminder.create({ data: { ...data, serviceId, dueDate: eligibility.dueDate! } });
  });
}

async function deliverClaim(claim: NonNullable<Awaited<ReturnType<typeof claimReminder>>>, today: string, settings: SiteEmailSettings, mailer: Mailer) {
  const current = await prisma.siteService.findUnique({ where: { id: claim.serviceId }, include: { site: { include: managedSiteInclude } } });
  const latestSettings = await getSiteEmailSettings();
  const site = current ? serializeManagedSite(current.site) : null;
  const service = site?.services.find(item => item.id === claim.serviceId);
  const eligible = site && service ? siteReminderEligibility(site, service, today, settings.leadDays) : null;
  if (!getSiteEmailRuntime().canSend || !latestSettings.enabled || latestSettings.version !== settings.version || !eligible?.eligible || eligible.dueDate !== claim.dueDate || eligible.recipient !== claim.recipient) {
    await prisma.siteEmailReminder.update({ where: { id: claim.id }, data: { status: "CANCELLED", error: "Avviso annullato: dati o impostazioni aggiornati prima dell’invio." } });
    return "cancelled" as const;
  }
  let result: TextEmailDeliveryResult;
  try { result = await mailer({ to: claim.recipient, from: SITE_EMAIL_FROM, replyTo: SITE_EMAIL_ADDRESS, subject: claim.subject, text: claim.text, idempotencyKey: `site-renewal/${claim.id}/${claim.attempts}` }); }
  catch { result = { sent: false, ambiguous: true, message: "Esito non confermato: verifica il provider prima di riprovare." }; }
  await prisma.siteEmailReminder.update({ where: { id: claim.id }, data: result.sent ? { status: "SENT", sentAt: new Date(), providerId: result.providerId || null, error: "" } : { status: result.ambiguous ? "UNKNOWN" : "FAILED", error: result.message.slice(0, 1000) } });
  return result.sent ? "sent" as const : result.ambiguous ? "unknown" as const : "failed" as const;
}

export async function processSiteEmailReminders(options: { now?: Date; mailer?: Mailer; pauseMs?: number; siteIds?: string[] } = {}) {
  const settings = await getSiteEmailSettings();
  const result = { sent: 0, failed: 0, unknown: 0, cancelled: 0, skipped: 0, blocked: false };
  if (!settings.enabled || !getSiteEmailRuntime().canSend || !matchesTest(await getTestStamp(), settings)) return { ...result, blocked: true };
  const today = formatDateKey(options.now || new Date());
  await prisma.siteEmailReminder.updateMany({ where: { status: "SENDING", startedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) }, ...(options.siteIds ? { service: { siteId: { in: options.siteIds } } } : {}) }, data: { status: "UNKNOWN", error: "Controllo interrotto: verificare l’esito sul provider prima di riprovare." } });
  const raw = await prisma.managedSite.findMany({ where: { archivedAt: null, emailRemindersEnabled: true, ...(options.siteIds ? { id: { in: options.siteIds } } : {}) }, include: managedSiteInclude });
  const start = Date.now();
  let attempts = 0;
  for (const site of raw.map(serializeManagedSite)) {
    for (const service of getSiteServicesToMonitor(site)) {
      if (attempts >= 20 || Date.now() - start > 40000) return result;
      if (!siteReminderEligibility(site, service, today, settings.leadDays).eligible) { result.skipped++; continue; }
      const claim = await claimReminder(site.id, service.id, today, settings);
      if (!claim) { result.skipped++; continue; }
      attempts++;
      const outcome = await deliverClaim(claim, today, settings, options.mailer || sendTextEmail);
      result[outcome]++;
      const pause = options.pauseMs ?? 650;
      if (pause > 0) await new Promise(resolve => setTimeout(resolve, pause));
    }
  }
  return result;
}

export async function retrySiteEmailReminder(userId: string, id: string, mailer: Mailer = sendTextEmail) {
  await assertEmailAdmin(userId);
  const settings = await getSiteEmailSettings();
  if (!settings.enabled || !getSiteEmailRuntime().canSend || !matchesTest(await getTestStamp(), settings)) throw new Error("Gli invii automatici non sono attivi o configurati.");
  const previous = await prisma.siteEmailReminder.findUnique({ where: { id }, include: { service: true } });
  if (!previous || previous.status !== "FAILED") throw new Error("Questo avviso non è ritentabile. Gli esiti non confermati vanno verificati sul provider.");
  const today = formatDateKey(new Date());
  const claim = await claimReminder(previous.service.siteId, previous.serviceId, today, settings, id);
  if (!claim) throw new Error("L’avviso è già stato gestito oppure i dati della scadenza sono cambiati.");
  return deliverClaim(claim, today, settings, mailer);
}
