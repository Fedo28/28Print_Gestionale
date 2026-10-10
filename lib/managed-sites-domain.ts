import { createSearchIndexValue, createSearchMatcher, matchesSearchIndexValue, normalizeCompactSearchText } from "@/lib/search-text";
import { isValidDay } from "@/lib/personal-workspace-domain";

export type DomainRenewalMode = "UNKNOWN" | "TOGETHER" | "SEPARATE";
export type SiteServiceKind = "HOSTING" | "DOMAIN";
export type SiteCustomer = { id: string; name: string; email?: string | null };
export type SiteServiceInput = {
  provider: string; renewalDay: number | null; renewalMonth: number | null; renewalYear: number | null;
  costCents: number | null; autoRenew: boolean | null;
};
export type SiteServiceRecord = SiteServiceInput & {
  id: string; kind: SiteServiceKind; version: number;
  renewals: { id: string; previousDueLabel: string; nextDueDate: string; renewedOn: string; costCents: number | null; includesDomain: boolean; note: string; recordedBy: string; createdAt: string }[];
  emailReminders?: import("@/lib/site-email-domain").SiteEmailReminderSummary[];
};
export type ManagedSiteRecord = {
  id: string; hostname: string; name: string; customerId: string | null; customer: SiteCustomer | null;
  domainRenewalMode: DomainRenewalMode; notes: string; version: number; archivedAt: string | null;
  emailRemindersEnabled?: boolean; renewalEmail?: string | null;
  services: SiteServiceRecord[];
};
export type ManagedSiteInput = {
  id?: string; version?: number; hostname: string; name: string; customerId: string | null;
  domainRenewalMode: DomainRenewalMode; notes: string; hosting: SiteServiceInput; domain: SiteServiceInput | null;
  emailRemindersEnabled?: boolean; renewalEmail?: string | null;
};
export type SiteRenewalInput = {
  siteId: string; siteVersion: number; serviceId: string; serviceVersion: number;
  renewedOn: string; nextDueDate: string; costCents: number | null; note: string;
};
export type SiteFilter = "ALL" | "UPCOMING" | "OVERDUE" | "UNCONFIRMED" | "UNASSIGNED" | "ARCHIVED";
export type RenewalState = "MISSING" | "UNCONFIRMED" | "OVERDUE" | "UPCOMING" | "CURRENT";
export const domainRenewalLabels: Record<DomainRenewalMode, string> = { UNKNOWN: "Da verificare", TOGETHER: "Con hosting", SEPARATE: "Separato" };
export const siteServiceLabels: Record<SiteServiceKind, string> = { HOSTING: "Hosting", DOMAIN: "Dominio" };
export const blankSiteService: SiteServiceInput = { provider: "", renewalDay: null, renewalMonth: null, renewalYear: null, costCents: null, autoRenew: null };

export function normalizeSiteHostname(raw: string) {
  const value = raw.trim();
  if (!value) throw new Error("Inserisci il dominio del sito.");
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); }
  catch { throw new Error("Dominio non valido."); }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (url.username || url.password || url.port || !/^https?:$/.test(url.protocol) || hostname.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(hostname)) throw new Error("Dominio non valido.");
  return hostname;
}

export function siteDateKey(day: number | null, month: number | null, year: number | null) {
  if (day === null || month === null || year === null) return null;
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidDay(value) ? value : null;
}

export function nextSiteAnniversary(service: SiteServiceInput, today: string) {
  if (service.renewalDay === null || service.renewalMonth === null) return null;
  for (let year = Number(today.slice(0, 4)); year <= Number(today.slice(0, 4)) + 4; year++) {
    const candidate = siteDateKey(service.renewalDay, service.renewalMonth, year);
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}

export function formatSiteDueDate(service: SiteServiceInput) {
  if (service.renewalDay === null || service.renewalMonth === null) return "Da inserire";
  return `${String(service.renewalDay).padStart(2, "0")}/${String(service.renewalMonth).padStart(2, "0")}${service.renewalYear === null ? "" : `/${service.renewalYear}`}`;
}

export function getSiteRenewalState(service: SiteServiceInput, today: string): { state: RenewalState; days: number | null; dueDate: string | null } {
  if (service.renewalDay === null || service.renewalMonth === null) return { state: "MISSING", days: null, dueDate: null };
  const dueDate = siteDateKey(service.renewalDay, service.renewalMonth, service.renewalYear);
  if (!dueDate) return { state: "UNCONFIRMED", days: null, dueDate: null };
  const days = Math.round((new Date(`${dueDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  return { state: days < 0 ? "OVERDUE" : days <= 30 ? "UPCOMING" : "CURRENT", days, dueDate };
}

export function getNextSiteRenewalDate(service: SiteServiceInput, today: string) {
  const current = siteDateKey(service.renewalDay, service.renewalMonth, service.renewalYear);
  if (!current) return "";
  const year = Number(current.slice(0, 4)) + 1;
  return siteDateKey(service.renewalDay, service.renewalMonth, year) || siteDateKey(28, 2, year)!;
}

function validateService(input: SiteServiceInput, required: boolean): SiteServiceInput {
  if (required && (input.renewalDay === null || input.renewalMonth === null)) throw new Error("Inserisci giorno e mese della scadenza hosting.");
  if ((input.renewalDay === null) !== (input.renewalMonth === null)) throw new Error("Completa giorno e mese della scadenza.");
  if (input.renewalYear !== null && (input.renewalDay === null || !Number.isInteger(input.renewalYear) || input.renewalYear < 1900 || input.renewalYear > 2200)) throw new Error("Anno della scadenza non valido.");
  if (input.renewalDay !== null && (!Number.isInteger(input.renewalDay) || !Number.isInteger(input.renewalMonth) || !siteDateKey(input.renewalDay, input.renewalMonth, input.renewalYear || 2000))) throw new Error("Data della scadenza non valida.");
  if (input.costCents !== null && (!Number.isSafeInteger(input.costCents) || input.costCents < 0 || input.costCents > 100000000)) throw new Error("Costo del rinnovo non valido.");
  if (input.autoRenew !== null && typeof input.autoRenew !== "boolean") throw new Error("Modalità di rinnovo non valida.");
  if (input.provider.trim().length > 180) throw new Error("Nome provider troppo lungo.");
  return { provider: input.provider.trim(), renewalDay: input.renewalDay, renewalMonth: input.renewalMonth,
    renewalYear: input.renewalYear, costCents: input.costCents, autoRenew: input.autoRenew };
}

export function validateManagedSite(input: ManagedSiteInput) {
  const hostname = normalizeSiteHostname(input.hostname);
  if (input.id && (!Number.isInteger(input.version) || (input.version ?? -1) < 0)) throw new Error("Ricarica il sito prima di modificarlo.");
  if (!Object.hasOwn(domainRenewalLabels, input.domainRenewalMode)) throw new Error("Modalità del dominio non valida.");
  if (input.name.trim().length > 180 || input.notes.trim().length > 4000) throw new Error("Nome o note troppo lunghi.");
  if (input.emailRemindersEnabled !== undefined && typeof input.emailRemindersEnabled !== "boolean") throw new Error("Impostazione degli avvisi non valida.");
  if (input.renewalEmail !== undefined && input.renewalEmail !== null && input.renewalEmail !== "" && (typeof input.renewalEmail !== "string" || input.renewalEmail.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(input.renewalEmail.trim()))) throw new Error("Email per gli avvisi non valida.");
  return { id: input.id, version: input.version, hostname, name: input.name.trim(), notes: input.notes.trim(), customerId: input.customerId || null,
    domainRenewalMode: input.domainRenewalMode, hosting: validateService(input.hosting, true),
    domain: input.domain ? validateService(input.domain, false) : input.domainRenewalMode === "SEPARATE" ? { ...blankSiteService } : null,
    ...(input.emailRemindersEnabled !== undefined ? { emailRemindersEnabled: input.emailRemindersEnabled } : {}),
    ...(input.renewalEmail !== undefined ? { renewalEmail: input.renewalEmail?.trim() || null } : {}) };
}

export function validateSiteRenewal(input: SiteRenewalInput) {
  if (!input.siteId || !input.serviceId || !Number.isInteger(input.siteVersion) || input.siteVersion < 0 || !Number.isInteger(input.serviceVersion) || input.serviceVersion < 0) throw new Error("Ricarica il sito prima di registrare il rinnovo.");
  if (!isValidDay(input.renewedOn) || !isValidDay(input.nextDueDate) || input.nextDueDate <= input.renewedOn) throw new Error("La prossima scadenza deve essere successiva alla data del rinnovo.");
  if (input.note.trim().length > 2000) throw new Error("Nota del rinnovo troppo lunga.");
  const [renewalYear, renewalMonth, renewalDay] = input.nextDueDate.split("-").map(Number);
  validateService({ ...blankSiteService, renewalYear, renewalMonth, renewalDay, costCents: input.costCents }, false);
  return { ...input, note: input.note.trim() };
}

export function getSiteServicesToMonitor(site: ManagedSiteRecord) {
  return site.services.filter(service => service.kind === "HOSTING" || site.domainRenewalMode === "SEPARATE");
}

export function suggestSiteCustomers(hostname: string, customers: SiteCustomer[]) {
  const stem = normalizeCompactSearchText(hostname.split(".")[0]);
  return customers.map(customer => {
    const name = normalizeCompactSearchText(customer.name.replace(/\b(srl|s\.r\.l|spa|snc|sas|società|societa)\b/gi, ""));
    const score = name.length >= 5 && stem.length >= 5 && (name.includes(stem) || stem.includes(name)) ? Math.min(name.length, stem.length) : 0;
    return { customer, score };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.customer.name.localeCompare(b.customer.name, "it")).slice(0, 3).map(entry => entry.customer);
}

export function filterManagedSites(sites: ManagedSiteRecord[], query: string, filter: SiteFilter, today: string) {
  const matcher = createSearchMatcher(query);
  return sites.filter(site => {
    if (filter === "ARCHIVED" ? !site.archivedAt : Boolean(site.archivedAt)) return false;
    const states = getSiteServicesToMonitor(site).map(service => getSiteRenewalState(service, today).state);
    if (filter === "UPCOMING" && !states.includes("UPCOMING")) return false;
    if (filter === "OVERDUE" && !states.includes("OVERDUE")) return false;
    if (filter === "UNCONFIRMED" && !states.some(state => state === "MISSING" || state === "UNCONFIRMED")) return false;
    if (filter === "UNASSIGNED" && site.customerId) return false;
    return !matcher.normalizedQuery || matchesSearchIndexValue(createSearchIndexValue([site.hostname, site.name, site.customer?.name || "", site.notes, ...site.services.map(service => service.provider)].join(" ")), matcher);
  }).sort((a, b) => {
    const earliest = (site: ManagedSiteRecord) => getSiteServicesToMonitor(site).map(service => siteDateKey(service.renewalDay, service.renewalMonth, service.renewalYear) || nextSiteAnniversary(service, today) || "9999-12-31").sort()[0] || "9999-12-31";
    return earliest(a).localeCompare(earliest(b)) || a.hostname.localeCompare(b.hostname);
  });
}
