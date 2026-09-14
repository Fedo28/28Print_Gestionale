import type { Prisma } from "@prisma/client";
import { normalizeShopServiceSlug } from "@/lib/domain/catalog/service-catalog";
import { prisma } from "@/lib/prisma";

type ServiceCatalogReader = Pick<typeof prisma, "serviceCatalog">;

const shopServiceSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  basePriceCents: true,
  unit: true,
  quantityTiers: true,
  onlineActive: true,
  onlineSlug: true,
  createJobAutomatically: true,
  shopSortOrder: true,
  shopConfigurationSchema: true,
  shopPricingSchema: true,
  shopFilePolicy: true,
  shopProductionPolicy: true
} satisfies Prisma.ServiceCatalogSelect;

export type ShopPublishedService = Prisma.ServiceCatalogGetPayload<{
  select: typeof shopServiceSelect;
}>;

function buildFallbackPreviewWhere(normalizedSlug: string) {
  const searchTerms = normalizedSlug
    .split("-")
    .map((term) => term.trim())
    .filter((term) => term.length >= 4)
    .slice(0, 4);

  if (!searchTerms.length) {
    return undefined;
  }

  return {
    OR: searchTerms.flatMap((term) => [
      {
        name: {
          contains: term,
          mode: "insensitive" as const
        }
      },
      {
        code: {
          contains: term.toUpperCase()
        }
      }
    ])
  } satisfies Prisma.ServiceCatalogWhereInput;
}

export async function listPublishedShopServices() {
  return prisma.serviceCatalog.findMany({
    where: {
      active: true,
      onlineActive: true
    },
    orderBy: [{ shopSortOrder: "asc" }, { name: "asc" }],
    select: shopServiceSelect
  });
}

export async function getPublishedShopServiceBySlug(slug: string) {
  const normalizedSlug = normalizeShopServiceSlug(slug);
  return prisma.serviceCatalog.findFirst({
    where: {
      active: true,
      onlineActive: true,
      onlineSlug: normalizedSlug
    },
    select: shopServiceSelect
  });
}

export async function getFeaturedShopService(targetSlug = "stampa-documenti") {
  const normalizedSlug = normalizeShopServiceSlug(targetSlug, { allowEmpty: true });

  if (normalizedSlug) {
    const exact = await prisma.serviceCatalog.findFirst({
      where: {
        active: true,
        onlineActive: true,
        onlineSlug: normalizedSlug
      },
      select: shopServiceSelect
    });

    if (exact) {
      return exact;
    }
  }

  return prisma.serviceCatalog.findFirst({
    where: {
      active: true,
      onlineActive: true
    },
    orderBy: [{ shopSortOrder: "asc" }, { name: "asc" }],
    select: shopServiceSelect
  });
}

export async function getShopServicePreviewCandidate(targetSlug = "stampa-documenti") {
  const published = await getFeaturedShopService(targetSlug);
  if (published) {
    return published;
  }

  const normalizedSlug = normalizeShopServiceSlug(targetSlug, { allowEmpty: true });
  const fallbackWhere = buildFallbackPreviewWhere(normalizedSlug);
  if (fallbackWhere) {
    const fallbackMatch = await prisma.serviceCatalog.findFirst({
      where: {
        active: true,
        ...fallbackWhere
      },
      orderBy: [{ name: "asc" }],
      select: shopServiceSelect
    });

    if (fallbackMatch) {
      return fallbackMatch;
    }
  }

  return prisma.serviceCatalog.findFirst({
    where: {
      active: true
    },
    orderBy: [{ name: "asc" }],
    select: shopServiceSelect
  });
}

export async function getShopServiceByIdForOrderCreation(
  id: string,
  options?: { allowPreviewFallback?: boolean; client?: ServiceCatalogReader }
) {
  const client = options?.client || prisma;
  const serviceId = String(id || "").trim();
  if (!serviceId) {
    return null;
  }

  const direct = await client.serviceCatalog.findFirst({
    where: {
      id: serviceId,
      active: true,
      onlineActive: true
    },
    select: shopServiceSelect
  });

  if (direct || !options?.allowPreviewFallback) {
    return direct;
  }

  return client.serviceCatalog.findFirst({
    where: {
      id: serviceId,
      active: true
    },
    select: shopServiceSelect
  });
}
