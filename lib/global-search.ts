import { mainPhaseLabels } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type GlobalSearchItem = {
  id: string;
  kind: "order" | "quote" | "customer" | "service" | "billboard";
  label: string;
  meta: string;
  href: string;
};

export type GlobalSearchSection = {
  key: string;
  label: string;
  items: GlobalSearchItem[];
};

function normalizeQuery(query: string) {
  return query.trim();
}

function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: "insensitive" as const
  };
}

function buildOrderSearchWhere(query: string, isQuote: boolean) {
  return {
    isQuote,
    OR: [
      { orderCode: containsInsensitive(query) },
      { title: containsInsensitive(query) },
      { customer: { name: containsInsensitive(query) } },
      { customer: { phone: containsInsensitive(query) } },
      { customer: { email: containsInsensitive(query) } }
    ]
  };
}

export async function searchGlobal(query: string): Promise<GlobalSearchSection[]> {
  const normalizedQuery = normalizeQuery(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const [orders, quotes, customers, services, billboardAssets, billboardBookings] = await Promise.all([
    prisma.order.findMany({
      where: buildOrderSearchWhere(normalizedQuery, false),
      select: {
        id: true,
        orderCode: true,
        title: true,
        deliveryAt: true,
        mainPhase: true,
        customer: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ deliveryAt: "asc" }],
      take: 5
    }),
    prisma.order.findMany({
      where: buildOrderSearchWhere(normalizedQuery, true),
      select: {
        id: true,
        orderCode: true,
        title: true,
        createdAt: true,
        customer: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 4
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: containsInsensitive(normalizedQuery) },
          { phone: containsInsensitive(normalizedQuery) },
          { email: containsInsensitive(normalizedQuery) },
          { taxCode: containsInsensitive(normalizedQuery) },
          { vatNumber: containsInsensitive(normalizedQuery) }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true
      },
      orderBy: [{ name: "asc" }],
      take: 5
    }),
    prisma.serviceCatalog.findMany({
      where: {
        OR: [
          { code: containsInsensitive(normalizedQuery) },
          { name: containsInsensitive(normalizedQuery) },
          { description: containsInsensitive(normalizedQuery) }
        ]
      },
      select: {
        id: true,
        code: true,
        name: true,
        basePriceCents: true
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 5
    }),
    prisma.billboardAsset.findMany({
      where: {
        active: true,
        OR: [
          { code: containsInsensitive(normalizedQuery) },
          { name: containsInsensitive(normalizedQuery) },
          { location: containsInsensitive(normalizedQuery) }
        ]
      },
      select: {
        id: true,
        name: true,
        location: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 3
    }),
    prisma.billboardBooking.findMany({
      where: {
        OR: [
          { note: containsInsensitive(normalizedQuery) },
          { customer: { name: containsInsensitive(normalizedQuery) } },
          { billboardAsset: { name: containsInsensitive(normalizedQuery) } }
        ]
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        note: true,
        customer: {
          select: {
            name: true
          }
        },
        billboardAsset: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ startsAt: "asc" }],
      take: 3
    })
  ]);

  const sections: GlobalSearchSection[] = [];

  if (orders.length > 0) {
    sections.push({
      key: "orders",
      label: "Ordini",
      items: orders.map((order) => ({
        id: order.id,
        kind: "order",
        label: `${order.orderCode} • ${order.title}`,
        meta: `${order.customer.name} • ${formatDateTime(order.deliveryAt)} • ${mainPhaseLabels[order.mainPhase]}`,
        href: `/orders/${order.id}`
      }))
    });
  }

  if (quotes.length > 0) {
    sections.push({
      key: "quotes",
      label: "Preventivi",
      items: quotes.map((quote) => ({
        id: quote.id,
        kind: "quote",
        label: `${quote.orderCode} • ${quote.title}`,
        meta: `${quote.customer.name} • Creato ${formatDate(quote.createdAt)}`,
        href: `/orders/${quote.id}`
      }))
    });
  }

  if (customers.length > 0) {
    sections.push({
      key: "customers",
      label: "Clienti",
      items: customers.map((customer) => ({
        id: customer.id,
        kind: "customer",
        label: customer.name,
        meta: [customer.phone, customer.email].filter(Boolean).join(" • ") || "Scheda cliente",
        href: `/customers/${customer.id}`
      }))
    });
  }

  if (services.length > 0) {
    sections.push({
      key: "services",
      label: "Catalogo",
      items: services.map((service) => ({
        id: service.id,
        kind: "service",
        label: service.name,
        meta: `${service.code || "Senza codice"} • ${formatCurrency(service.basePriceCents)}`,
        href: "/settings"
      }))
    });
  }

  const billboardItems: GlobalSearchItem[] = [
    ...billboardAssets.map((asset) => ({
      id: asset.id,
      kind: "billboard" as const,
      label: asset.name,
      meta: asset.location ? `Impianto • ${asset.location}` : "Impianto pubblicitario",
      href: "/billboards"
    })),
    ...billboardBookings.map((booking) => ({
      id: booking.id,
      kind: "billboard" as const,
      label: `${booking.billboardAsset.name} • ${booking.customer.name}`,
      meta: `${formatDate(booking.startsAt)} - ${formatDate(booking.endsAt)}${booking.note ? ` • ${booking.note}` : ""}`,
      href: "/billboards"
    }))
  ];

  if (billboardItems.length > 0) {
    sections.push({
      key: "billboards",
      label: "Cartelloni",
      items: billboardItems.slice(0, 5)
    });
  }

  return sections;
}
