import { isValidDay } from "@/lib/personal-workspace-domain";
import { formatDate } from "@/lib/format";
import { getSiteRenewalState, getSiteServicesToMonitor, siteDateKey } from "@/lib/managed-sites-domain";
import type { ManagedSiteRecord, SiteServiceRecord } from "@/lib/managed-sites-domain";

export const SITE_EMAIL_ADDRESS = "info@28print.it";
export const SITE_EMAIL_FROM = `28 Print <${SITE_EMAIL_ADDRESS}>`;
export type SiteEmailMode = "INFORMATION" | "CONFIRMATION";
export type SiteEmailSettings = { version: number; enabled: boolean; leadDays: number; mode: SiteEmailMode; subject: string; text: string };
export type SiteEmailReminderSummary = { id: string; dueDate: string; status: "SENDING" | "SENT" | "FAILED" | "UNKNOWN" | "CANCELLED"; recipient: string; sentAt: string | null; error: string };
export const defaultSiteEmailSettings: SiteEmailSettings = {
  version: 0, enabled: false, leadDays: 30, mode: "INFORMATION", subject: "Promemoria rinnovo — {sito}",
  text: "Buongiorno {cliente},\n\nti ricordiamo che il servizio di {servizio} per {sito} è in scadenza il {scadenza}.\n\nPer informazioni sul servizio o sul rinnovo puoi rispondere a questa email.\n\nGrazie,\n28 Print"
};
export const confirmationSiteEmailText = "Buongiorno {cliente},\n\nti ricordiamo che il servizio di {servizio} per {sito} è in scadenza il {scadenza}.\n\nPer confermare il rinnovo, ti chiediamo di rispondere a questa email.\n\nGrazie,\n28 Print";
const variables = ["cliente", "sito", "servizio", "scadenza"];

export function isSiteContactEmail(value: string) { return value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value); }
export function validateSiteContactEmail(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !isSiteContactEmail(value.trim())) throw new Error("Email per gli avvisi non valida.");
  return value.trim();
}
export function validateSiteEmailSettings(input: SiteEmailSettings): SiteEmailSettings {
  if (!Number.isInteger(input.version) || input.version < 0 || typeof input.enabled !== "boolean" || !Number.isInteger(input.leadDays) || input.leadDays < 1 || input.leadDays > 90 || !["INFORMATION", "CONFIRMATION"].includes(input.mode)) throw new Error("Impostazioni degli avvisi non valide.");
  if (typeof input.subject !== "string" || typeof input.text !== "string" || !input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject) || !input.text.trim() || input.text.length > 6000) throw new Error("Oggetto o testo della mail non validi.");
  for (const match of `${input.subject}\n${input.text}`.matchAll(/\{([^{}]+)\}/g)) if (!variables.includes(match[1])) throw new Error(`Variabile non riconosciuta: {${match[1]}}.`);
  return { version: input.version, enabled: input.enabled, leadDays: input.leadDays, mode: input.mode, subject: input.subject.trim(), text: input.text.trim() };
}
export function parseSiteEmailSettings(raw?: string | null): SiteEmailSettings {
  if (!raw) return { ...defaultSiteEmailSettings };
  try { return validateSiteEmailSettings(JSON.parse(raw)); } catch { return { ...defaultSiteEmailSettings }; }
}

export type SiteReminderEligibility = { eligible: boolean; reason: string; recipient: string | null; dueDate: string | null };
export function siteReminderEligibility(site: ManagedSiteRecord, service: SiteServiceRecord, today: string, leadDays: number): SiteReminderEligibility {
  const dueDate = siteDateKey(service.renewalDay, service.renewalMonth, service.renewalYear);
  const recipient = site.renewalEmail?.trim() || site.customer?.email?.trim() || null;
  const blocked = (reason: string) => ({ eligible: false, reason, recipient, dueDate });
  if (site.archivedAt) return blocked("Sito archiviato");
  if (!site.emailRemindersEnabled) return blocked("Avvisi disattivati per questo sito");
  if (!site.customerId || !site.customer) return blocked("Cliente da associare");
  if (!recipient || !isSiteContactEmail(recipient)) return blocked("Email del cliente da completare");
  if (!getSiteServicesToMonitor(site).some(item => item.id === service.id)) return blocked("Servizio incluso nel rinnovo hosting");
  if (!dueDate) return blocked("Anno o data della scadenza da confermare");
  if (!isValidDay(today)) return blocked("Data del controllo non valida");
  const state = getSiteRenewalState(service, today);
  if (state.days === null || state.days < 0) return blocked("Scadenza già passata");
  if (state.days > leadDays) return blocked("Fuori dal periodo di preavviso");
  return { eligible: true, reason: "Pronto per l’avviso", recipient, dueDate };
}

export function renderSiteReminder(site: ManagedSiteRecord, service: SiteServiceRecord, settings: SiteEmailSettings) {
  const date = siteDateKey(service.renewalDay, service.renewalMonth, service.renewalYear);
  const data: Record<string, string> = {
    cliente: site.customer?.name || "{cliente}", sito: site.hostname,
    servizio: service.kind === "DOMAIN" ? "dominio" : site.domainRenewalMode === "TOGETHER" ? "hosting e dominio" : "web hosting",
    scadenza: date ? formatDate(`${date}T12:00:00Z`) : "{scadenza}"
  };
  const render = (template: string) => template.replace(/\{(cliente|sito|servizio|scadenza)\}/g, (_, key: string) => data[key]);
  return { from: SITE_EMAIL_FROM, replyTo: SITE_EMAIL_ADDRESS, to: site.renewalEmail || site.customer?.email || "", subject: render(settings.subject).replace(/[\r\n]+/g, " "), text: render(settings.text) };
}
