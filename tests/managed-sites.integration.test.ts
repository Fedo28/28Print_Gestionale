import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { archiveManagedSite, associateManagedSite, recordSiteRenewal, saveManagedSite, serializeManagedSite, managedSiteInclude } from "../lib/managed-sites";
import { blankSiteService, getSiteServicesToMonitor } from "../lib/managed-sites-domain";
import type { ManagedSiteInput, ManagedSiteRecord } from "../lib/managed-sites-domain";

const databaseUrl = process.env.MANAGED_SITES_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/fede_personal_preview" || process.env.DATABASE_URL !== databaseUrl) throw new Error("I test siti richiedono la sola copia locale dell'anteprima.");
}

describe.runIf(Boolean(databaseUrl))("managed sites integration", () => {
  const actors = [randomUUID(), randomUUID(), randomUUID()];
  const customerId = randomUUID();
  const createdIds: string[] = [];
  const base = (changes: Partial<ManagedSiteInput> = {}): ManagedSiteInput => ({ hostname: `site-test-${randomUUID()}.invalid`, name: "[Verifica] Sito", customerId: null, domainRenewalMode: "UNKNOWN", notes: "",
    hosting: { ...blankSiteService, renewalDay: 20, renewalMonth: 10, renewalYear: 2026 }, domain: null, ...changes });
  const create = async (changes: Partial<ManagedSiteInput> = {}) => { const site = await saveManagedSite(actors[0], base(changes)); createdIds.push(site.id); return site; };
  const fresh = async (id: string) => serializeManagedSite(await prisma.managedSite.findUniqueOrThrow({ where: { id }, include: managedSiteInclude }));
  const renewal = (site: ManagedSiteRecord) => ({ siteId: site.id, siteVersion: site.version, serviceId: site.services.find(service => service.kind === "HOSTING")!.id,
    serviceVersion: site.services.find(service => service.kind === "HOSTING")!.version, renewedOn: "2026-10-09", nextDueDate: "2027-10-20", costCents: 9500, note: "Rinnovo di prova" });

  beforeAll(async () => {
    for (const [index, id] of actors.entries()) await prisma.user.create({ data: { id, name: `[Verifica siti] Profilo ${index}`, nickname: `sites-${id}`, email: `${id}@example.invalid`, passwordHash: "not-used", role: "OPERATOR", active: index !== 2 } });
    await prisma.customer.create({ data: { id: customerId, name: "[Verifica siti] Cliente" } });
  });
  afterAll(async () => {
    await prisma.managedSite.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { id: { in: actors } } });
    await prisma.$disconnect();
  });

  it("creates an optional unassigned site and keeps dates with no year", async () => {
    const site = await create({ hosting: { ...blankSiteService, renewalDay: 7, renewalMonth: 8 }, notes: "Da associare dopo" });
    expect(site.customerId).toBeNull(); expect(site.services[0].renewalYear).toBeNull(); expect(site.services[0].renewalDay).toBe(7);
    const edited = await saveManagedSite(actors[0], { ...base(), id: site.id, version: site.version, hostname: site.hostname, hosting: site.services[0], notes: "Nota modificata" });
    expect(edited.notes).toBe("Nota modificata"); expect(edited.services[0].renewalYear).toBeNull();
  });
  it("does not create duplicate sites from uppercase or www variants", async () => {
    const site = await create();
    await expect(saveManagedSite(actors[0], base({ hostname: `https://WWW.${site.hostname.toUpperCase()}/` }))).rejects.toThrow(/già presente/);
    expect(await prisma.managedSite.count({ where: { hostname: site.hostname } })).toBe(1);
  });
  it("associates a customer later and rejects stale or invalid assignments", async () => {
    const site = await create();
    const assigned = await associateManagedSite(actors[1], site.id, site.version, customerId);
    expect(assigned.customer?.id).toBe(customerId);
    await expect(associateManagedSite(actors[0], site.id, site.version, null)).rejects.toThrow(/aggiornato/);
    await expect(associateManagedSite(actors[0], site.id, assigned.version, randomUUID())).rejects.toThrow(/Cliente/);
    expect((await associateManagedSite(actors[0], site.id, assigned.version, null)).customerId).toBeNull();
  });
  it("keeps separate hosting and domain deadlines when switching renewal modes", async () => {
    const site = await create({ domainRenewalMode: "SEPARATE", domain: { ...blankSiteService, renewalDay: 1, renewalMonth: 7, renewalYear: 2027 } });
    expect(getSiteServicesToMonitor(site)).toHaveLength(2);
    const together = await saveManagedSite(actors[0], { ...base(), id: site.id, version: site.version, hostname: site.hostname, domainRenewalMode: "TOGETHER", hosting: site.services.find(service => service.kind === "HOSTING")!, domain: site.services.find(service => service.kind === "DOMAIN")! });
    expect(getSiteServicesToMonitor(together)).toHaveLength(1);
    expect(together.services.find(service => service.kind === "DOMAIN")?.renewalMonth).toBe(7);
  });
  it("records renewals atomically, remembers combined domains and protects them from stale edits", async () => {
    const site = await create({ domainRenewalMode: "TOGETHER" });
    const oldEditor = { ...base(), id: site.id, version: site.version, hostname: site.hostname, hosting: site.services[0] };
    const renewed = await recordSiteRenewal(actors[0], renewal(site));
    expect(renewed.services[0].renewalYear).toBe(2027);
    expect(renewed.services[0].renewals).toHaveLength(1);
    expect(renewed.services[0].renewals[0]).toMatchObject({ includesDomain: true, previousDueLabel: "20/10/2026", nextDueDate: "2027-10-20", costCents: 9500 });
    await expect(saveManagedSite(actors[1], oldEditor)).rejects.toThrow(/aggiornato/);
    await expect(recordSiteRenewal(actors[1], renewal(site))).rejects.toThrow(/aggiornato/);
    expect((await fresh(site.id)).services[0].renewals).toHaveLength(1);
  });
  it("only registers one of two concurrent renewal attempts", async () => {
    const site = await create();
    const results = await Promise.allSettled([recordSiteRenewal(actors[0], renewal(site)), recordSiteRenewal(actors[1], renewal(site))]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await fresh(site.id)).services[0].renewals).toHaveLength(1);
  });
  it("archives recoverably and blocks renewals until the site is restored", async () => {
    const site = await create();
    await archiveManagedSite(actors[0], site.id, site.version, true);
    const archived = await fresh(site.id);
    expect(archived.archivedAt).not.toBeNull();
    await expect(recordSiteRenewal(actors[0], renewal(archived))).rejects.toThrow(/non disponibile/);
    await archiveManagedSite(actors[0], archived.id, archived.version, false);
    expect((await fresh(site.id)).archivedAt).toBeNull();
  });
  it("denies writes from a disabled or nonexistent staff profile", async () => {
    await expect(saveManagedSite(actors[2], base())).rejects.toThrow(/non attivo/);
    await expect(saveManagedSite(randomUUID(), base())).rejects.toThrow(/non attivo/);
  });
});
