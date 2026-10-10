import { describe, expect, it } from "vitest";
import { blankSiteService, filterManagedSites, getNextSiteRenewalDate, getSiteRenewalState, getSiteServicesToMonitor, nextSiteAnniversary, normalizeSiteHostname, suggestSiteCustomers, validateManagedSite, validateSiteRenewal } from "../lib/managed-sites-domain";
import type { ManagedSiteInput, ManagedSiteRecord, SiteServiceRecord } from "../lib/managed-sites-domain";

const today = "2026-10-09";
const hosting = (changes = {}) => ({ ...blankSiteService, renewalDay: 20, renewalMonth: 10, ...changes });
const site = (id: string, changes: Partial<ManagedSiteRecord> = {}): ManagedSiteRecord => ({ id, hostname: `${id}.it`, name: "", customerId: null, customer: null, domainRenewalMode: "UNKNOWN", notes: "", version: 0, archivedAt: null,
  services: [{ ...hosting(), id: `${id}-hosting`, kind: "HOSTING", version: 0, renewals: [] }], ...changes });
const input = (changes: Partial<ManagedSiteInput> = {}): ManagedSiteInput => ({ hostname: "example.it", name: "", customerId: null, domainRenewalMode: "UNKNOWN", notes: "", hosting: hosting(), domain: null, ...changes });

describe("managed sites", () => {
  it("normalizes pasted site addresses without keeping paths or credentials", () => {
    expect(normalizeSiteHostname(" HTTPS://WWW.AtlasCentroSpecialistico.IT/info ")).toBe("atlascentrospecialistico.it");
    for (const invalid of ["localhost", "not a domain", "https://user:password@example.it", "https://example.it:3001", "127.0.0.1", "-invalid.it"]) expect(() => normalizeSiteHostname(invalid)).toThrow();
  });
  it("stores hosting dates without inventing a year or a customer", () => {
    const parsed = validateManagedSite(input());
    expect(parsed.hosting.renewalYear).toBeNull(); expect(parsed.customerId).toBeNull(); expect(parsed.domain).toBeNull();
    expect(getSiteRenewalState(hosting({ renewalDay: 24, renewalMonth: 2 }), today)).toMatchObject({ state: "UNCONFIRMED", dueDate: null });
  });
  it("does not infer an actual expiration date from automatic renewal settings", () => {
    expect(getSiteRenewalState(hosting({ renewalYear: 2026, renewalDay: 1, renewalMonth: 2, autoRenew: true }), today).state).toBe("OVERDUE");
    expect(getNextSiteRenewalDate(hosting(), today)).toBe("");
  });
  it("handles today, the 30-day boundary, and overdue dates in calendar days", () => {
    expect(getSiteRenewalState(hosting({ renewalDay: 9, renewalYear: 2026 }), today)).toMatchObject({ state: "UPCOMING", days: 0 });
    expect(getSiteRenewalState(hosting({ renewalDay: 8, renewalMonth: 11, renewalYear: 2026 }), today)).toMatchObject({ state: "UPCOMING", days: 30 });
    expect(getSiteRenewalState(hosting({ renewalDay: 9, renewalMonth: 11, renewalYear: 2026 }), today).state).toBe("CURRENT");
    expect(getSiteRenewalState(hosting({ renewalDay: 8, renewalYear: 2026 }), today)).toMatchObject({ state: "OVERDUE", days: -1 });
  });
  it("orders recurring dates across the end of the year without labeling missing years overdue", () => {
    const early = site("early", { services: [{ ...hosting({ renewalDay: 5, renewalMonth: 2 }), id: "a", kind: "HOSTING", version: 0, renewals: [] }] });
    const imminent = site("imminent");
    expect(nextSiteAnniversary(early.services[0], today)).toBe("2027-02-05");
    expect(filterManagedSites([early, imminent], "", "ALL", today).map(row => row.id)).toEqual(["imminent", "early"]);
    expect(filterManagedSites([early, imminent], "", "OVERDUE", today)).toEqual([]);
  });
  it("validates leap years and impossible day/month combinations", () => {
    expect(() => validateManagedSite(input({ hosting: hosting({ renewalDay: 31, renewalMonth: 4 }) }))).toThrow(/Data/);
    expect(() => validateManagedSite(input({ hosting: hosting({ renewalDay: 29, renewalMonth: 2, renewalYear: 2027 }) }))).toThrow(/Data/);
    expect(validateManagedSite(input({ hosting: hosting({ renewalDay: 29, renewalMonth: 2 }) })).hosting.renewalDay).toBe(29);
    expect(nextSiteAnniversary(hosting({ renewalDay: 29, renewalMonth: 2 }), today)).toBe("2028-02-29");
    expect(getNextSiteRenewalDate(hosting({ renewalDay: 29, renewalMonth: 2, renewalYear: 2028 }), today)).toBe("2029-02-28");
  });
  it("only monitors a separate domain and preserves its independent date", () => {
    const domain: SiteServiceRecord = { ...hosting({ renewalDay: 1, renewalMonth: 7, renewalYear: 2026 }), id: "domain", kind: "DOMAIN", version: 0, renewals: [] };
    const row = site("paired", { domainRenewalMode: "TOGETHER" }); row.services.push(domain);
    expect(getSiteServicesToMonitor(row)).toHaveLength(1);
    expect(filterManagedSites([row], "", "OVERDUE", today)).toHaveLength(0);
    row.domainRenewalMode = "SEPARATE";
    expect(getSiteServicesToMonitor(row)).toHaveLength(2);
    expect(filterManagedSites([row], "", "OVERDUE", today)).toHaveLength(1);
    expect(validateManagedSite(input({ domainRenewalMode: "SEPARATE" })).domain).toEqual(blankSiteService);
  });
  it("offers possible customer matches without assigning anyone", () => {
    const customers = [{ id: "atlas", name: "Atlas" }, { id: "gm", name: "GM Composite Srl" }, { id: "other", name: "Mario Rossi" }];
    expect(suggestSiteCustomers("atlascentrospecialistico.it", customers).map(row => row.id)).toEqual(["atlas"]);
    expect(suggestSiteCustomers("gmcomposite.it", customers).map(row => row.id)).toEqual(["gm"]);
    expect(suggestSiteCustomers("unknown.it", customers)).toEqual([]);
  });
  it("filters associations, archived sites and customer names", () => {
    const assigned = site("assigned", { customerId: "customer", customer: { id: "customer", name: "Edilizia Più" } });
    const unassigned = site("unassigned"), archived = site("archived", { archivedAt: "2026-10-09T12:00:00Z" });
    expect(filterManagedSites([assigned, unassigned, archived], "ediliziapiu", "ALL", today).map(row => row.id)).toEqual(["assigned"]);
    expect(filterManagedSites([assigned, unassigned, archived], "", "UNASSIGNED", today).map(row => row.id)).toEqual(["unassigned"]);
    expect(filterManagedSites([assigned, unassigned, archived], "", "ARCHIVED", today).map(row => row.id)).toEqual(["archived"]);
  });
  it("requires valid renewal dates and a next deadline after the recorded renewal", () => {
    const renewal = { siteId: "site", siteVersion: 0, serviceId: "service", serviceVersion: 0, renewedOn: today, nextDueDate: "2027-10-20", costCents: 4500, note: " Rinnovato " };
    expect(validateSiteRenewal(renewal).note).toBe("Rinnovato");
    for (const changes of [{ nextDueDate: today }, { nextDueDate: "2027-02-30" }, { costCents: -1 }, { serviceVersion: -1 }, { nextDueDate: "2300-10-20" }]) expect(() => validateSiteRenewal({ ...renewal, ...changes })).toThrow();
  });
  it("only accepts editable fields when a serialized service or extra payload is submitted", () => {
    const raw = { ...input(), archivedAt: "2026-10-09", hosting: { ...hosting(), id: "injected", siteId: "different", kind: "DOMAIN", renewals: [] } };
    const parsed = validateManagedSite(raw);
    expect(parsed).not.toHaveProperty("archivedAt"); expect(parsed.hosting).not.toHaveProperty("siteId"); expect(parsed.hosting).not.toHaveProperty("renewals");
  });
});
