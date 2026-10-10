import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatSiteDueDate, validateManagedSite, validateSiteRenewal } from "@/lib/managed-sites-domain";
import { formatDateKey } from "@/lib/format";
import type { ManagedSiteInput, ManagedSiteRecord, SiteRenewalInput, SiteServiceInput } from "@/lib/managed-sites-domain";

export const managedSiteInclude = {
  customer: { select: { id: true, name: true, email: true } },
  services: { include: {
    renewals: { include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
    emailReminders: { select: { id: true, dueDate: true, status: true, recipient: true, sentAt: true, error: true }, orderBy: { createdAt: "desc" as const }, take: 20 }
  }, orderBy: { kind: "asc" as const } }
} satisfies Prisma.ManagedSiteInclude;
type SiteRecord = Prisma.ManagedSiteGetPayload<{ include: typeof managedSiteInclude }>;

export function serializeManagedSite(site: SiteRecord): ManagedSiteRecord {
  return { id: site.id, hostname: site.hostname, name: site.name, customerId: site.customerId, customer: site.customer,
    domainRenewalMode: site.domainRenewalMode, notes: site.notes, emailRemindersEnabled: site.emailRemindersEnabled, renewalEmail: site.renewalEmail,
    version: site.version, archivedAt: site.archivedAt?.toISOString() || null,
    services: site.services.map(service => ({ id: service.id, kind: service.kind, provider: service.provider,
      renewalDay: service.renewalDay, renewalMonth: service.renewalMonth, renewalYear: service.renewalYear,
      costCents: service.costCents, autoRenew: service.autoRenew, version: service.version,
      emailReminders: service.emailReminders.map(reminder => ({ ...reminder, sentAt: reminder.sentAt?.toISOString() || null })),
      renewals: service.renewals.map(renewal => ({ id: renewal.id, previousDueLabel: renewal.previousDueLabel, nextDueDate: renewal.nextDueDate,
        renewedOn: renewal.renewedOn, costCents: renewal.costCents, includesDomain: renewal.includesDomain, note: renewal.note, recordedBy: renewal.recordedBy?.name || "Profilo non disponibile", createdAt: renewal.createdAt.toISOString() })) })) };
}

async function assertSiteActor(userId: string) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!actor?.active) throw new Error("Profilo non attivo. Accedi di nuovo.");
}

export async function getManagedSites() {
  const [sites, customers] = await Promise.all([
    prisma.managedSite.findMany({ include: managedSiteInclude, orderBy: { hostname: "asc" } }),
    prisma.customer.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
  ]);
  return { sites: sites.map(serializeManagedSite), customers };
}

async function saveService(tx: Prisma.TransactionClient, siteId: string, kind: "HOSTING" | "DOMAIN", data: SiteServiceInput) {
  await tx.siteService.upsert({ where: { siteId_kind: { siteId, kind } }, create: { siteId, kind, ...data }, update: { ...data, version: { increment: 1 } } });
}

export async function saveManagedSite(userId: string, raw: ManagedSiteInput) {
  await assertSiteActor(userId);
  const input = validateManagedSite(raw);
  if (input.customerId && !await prisma.customer.findUnique({ where: { id: input.customerId }, select: { id: true } })) throw new Error("Cliente non disponibile.");
  try {
    return await prisma.$transaction(async tx => {
      const { id, version, hosting, domain, ...data } = input;
      let siteId = id;
      if (id) {
        const updated = await tx.managedSite.updateMany({ where: { id, version, archivedAt: null }, data: { ...data, version: { increment: 1 } } });
        if (!updated.count) throw new Error("Il sito è stato aggiornato da un collega. Ricarica prima di salvare.");
      } else {
        siteId = (await tx.managedSite.create({ data })).id;
      }
      await saveService(tx, siteId!, "HOSTING", hosting);
      if (domain) await saveService(tx, siteId!, "DOMAIN", domain);
      return serializeManagedSite(await tx.managedSite.findUniqueOrThrow({ where: { id: siteId }, include: managedSiteInclude }));
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Questo dominio è già presente. Cerca il sito nella lista, anche tra gli archiviati.");
    throw error;
  }
}

export async function associateManagedSite(userId: string, siteId: string, version: number, customerId: string | null) {
  await assertSiteActor(userId);
  if (!siteId || !Number.isInteger(version) || version < 0) throw new Error("Ricarica il sito prima di associarlo.");
  if (customerId && !await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })) throw new Error("Cliente non disponibile.");
  const changed = await prisma.managedSite.updateMany({ where: { id: siteId, version, archivedAt: null }, data: { customerId, version: { increment: 1 } } });
  if (!changed.count) throw new Error("Il sito è stato aggiornato da un collega. Ricarica prima di associarlo.");
  return serializeManagedSite(await prisma.managedSite.findUniqueOrThrow({ where: { id: siteId }, include: managedSiteInclude }));
}

export async function archiveManagedSite(userId: string, id: string, version: number, archived: boolean) {
  await assertSiteActor(userId);
  if (!id || !Number.isInteger(version) || version < 0 || typeof archived !== "boolean") throw new Error("Operazione non valida.");
  const changed = await prisma.managedSite.updateMany({ where: { id, version, archivedAt: archived ? null : { not: null } }, data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } } });
  if (!changed.count) throw new Error("Il sito è stato aggiornato da un collega. Ricarica prima di continuare.");
}

export async function recordSiteRenewal(userId: string, raw: SiteRenewalInput) {
  await assertSiteActor(userId);
  const input = validateSiteRenewal(raw);
  if (input.renewedOn > formatDateKey(new Date())) throw new Error("La data del rinnovo non può essere futura.");
  return prisma.$transaction(async tx => {
    const site = await tx.managedSite.findUnique({ where: { id: input.siteId }, include: { services: true } });
    const service = site?.services.find(entry => entry.id === input.serviceId);
    if (!site || site.archivedAt || !service || (service.kind === "DOMAIN" && site.domainRenewalMode !== "SEPARATE")) throw new Error("Servizio non disponibile per il rinnovo.");
    const changedSite = await tx.managedSite.updateMany({ where: { id: site.id, version: input.siteVersion, archivedAt: null }, data: { version: { increment: 1 } } });
    if (!changedSite.count) throw new Error("Il sito è stato aggiornato da un collega. Ricarica prima di registrare il rinnovo.");
    const [renewalYear, renewalMonth, renewalDay] = input.nextDueDate.split("-").map(Number);
    const changedService = await tx.siteService.updateMany({ where: { id: service.id, version: input.serviceVersion }, data: { renewalDay, renewalMonth, renewalYear, version: { increment: 1 } } });
    if (!changedService.count) throw new Error("La scadenza è stata aggiornata da un collega. Ricarica prima di continuare.");
    await tx.siteRenewal.create({ data: { serviceId: service.id, previousDueLabel: formatSiteDueDate(service), nextDueDate: input.nextDueDate,
      renewedOn: input.renewedOn, costCents: input.costCents, includesDomain: service.kind === "HOSTING" && site.domainRenewalMode === "TOGETHER", note: input.note, recordedById: userId } });
    return serializeManagedSite(await tx.managedSite.findUniqueOrThrow({ where: { id: site.id }, include: managedSiteInclude }));
  });
}
