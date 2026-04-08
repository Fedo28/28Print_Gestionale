import { BillboardAssetKind, BillboardBookingStatus } from "@prisma/client";
import { billboardAssetKindLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type BillboardPdfUpload = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
};

export type CreateBillboardBookingInput = {
  billboardAssetId: string;
  customerId: string;
  status?: BillboardBookingStatus;
  startsAt: Date;
  endsAt: Date;
  priceCents?: number;
  paidCents?: number;
  note?: string;
  pdf?: BillboardPdfUpload | null;
};

export const DEFAULT_BILLBOARD_ASSET_DEFINITIONS = [
  ...Array.from({ length: 24 }, (_, index) => ({
    code: `CARTELLONE_${String(index + 1).padStart(2, "0")}`,
    name: `Cartellone ${String(index + 1).padStart(2, "0")}`,
    kind: "CARTELLONE" as const,
    sortOrder: index + 1
  })),
  {
    code: "MONITOR_01",
    name: "Monitor",
    kind: "MONITOR" as const,
    sortOrder: 25
  },
  {
    code: "VELA_01",
    name: "Vela itinerante",
    kind: "VELA_ITINERANTE" as const,
    sortOrder: 26
  }
] as const;

export function parseBillboardBookingDate(raw: string | null, fieldLabel: string) {
  const value = (raw || "").trim();
  if (!value) {
    throw new Error(`${fieldLabel} obbligatorio.`);
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} non valido.`);
  }

  return parsed;
}

export function rangesOverlap(
  leftStart: Date | string,
  leftEnd: Date | string,
  rightStart: Date | string,
  rightEnd: Date | string
) {
  return new Date(leftStart).getTime() <= new Date(rightEnd).getTime() &&
    new Date(leftEnd).getTime() >= new Date(rightStart).getTime();
}

function normalizeToDayBoundary(value: Date | string) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function bookingIncludesDate(
  booking: { startsAt: Date | string; endsAt: Date | string },
  date: Date | string
) {
  return rangesOverlap(
    normalizeToDayBoundary(booking.startsAt),
    normalizeToDayBoundary(booking.endsAt),
    normalizeToDayBoundary(date),
    normalizeToDayBoundary(date)
  );
}

export function calculateBillboardBookingBalanceCents(priceCents: number, paidCents: number) {
  const safePrice = Math.max(0, Math.round(priceCents));
  const safePaid = Math.max(0, Math.round(paidCents));
  return Math.max(0, safePrice - safePaid);
}

export function reservesBillboardAsset(status: BillboardBookingStatus) {
  return status !== "SCADUTO";
}

export function buildBillboardAssetSeed() {
  return DEFAULT_BILLBOARD_ASSET_DEFINITIONS.map((asset) => ({
    ...asset,
    location: null,
    active: true
  }));
}

export async function ensureBillboardAssets() {
  const existing = await prisma.billboardAsset.findMany({
    select: { code: true }
  });
  const existingCodes = new Set(existing.map((asset) => asset.code));
  const missing = buildBillboardAssetSeed().filter((asset) => !existingCodes.has(asset.code));

  if (!missing.length) {
    return;
  }

  await prisma.billboardAsset.createMany({
    data: missing
  });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0);
}

export async function getBillboardSurface(referenceDate: Date) {
  await ensureBillboardAssets();

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);

  const [assets, monthBookings, upcomingBookings, historyBookings] = await Promise.all([
    prisma.billboardAsset.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        bookings: {
          where: {
            status: {
              not: "SCADUTO"
            },
            endsAt: {
              gte: today
            }
          },
          include: {
            customer: true
          },
          orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
          take: 3
        }
      }
    }),
    prisma.billboardBooking.findMany({
      where: {
        status: {
          not: "SCADUTO"
        },
        startsAt: {
          lte: monthEnd
        },
        endsAt: {
          gte: monthStart
        }
      },
      include: {
        customer: true,
        billboardAsset: true
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
    }),
    prisma.billboardBooking.findMany({
      where: {
        status: {
          not: "SCADUTO"
        },
        endsAt: {
          gte: today
        }
      },
      include: {
        customer: true,
        billboardAsset: true
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      take: 18
    }),
    prisma.billboardBooking.findMany({
      include: {
        customer: true,
        billboardAsset: true
      },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const customerHistoryMap = new Map<
    string,
    {
      customer: (typeof historyBookings)[number]["customer"];
      bookingCount: number;
      confirmedCount: number;
      optionCount: number;
      totalValueCents: number;
      totalPaidCents: number;
      totalBalanceDueCents: number;
      latestStartsAt: Date;
      latestEndsAt: Date;
      latestAssets: string[];
    }
  >();

  for (const booking of historyBookings) {
    const current = customerHistoryMap.get(booking.customerId);
    if (!current) {
      customerHistoryMap.set(booking.customerId, {
        customer: booking.customer,
        bookingCount: 1,
        confirmedCount: booking.status === "CONFERMATO" ? 1 : 0,
        optionCount: booking.status === "OPZIONATO" ? 1 : 0,
        totalValueCents: booking.priceCents,
        totalPaidCents: booking.paidCents,
        totalBalanceDueCents: booking.balanceDueCents,
        latestStartsAt: booking.startsAt,
        latestEndsAt: booking.endsAt,
        latestAssets: [booking.billboardAsset.name]
      });
      continue;
    }

    current.bookingCount += 1;
    current.confirmedCount += booking.status === "CONFERMATO" ? 1 : 0;
    current.optionCount += booking.status === "OPZIONATO" ? 1 : 0;
    current.totalValueCents += booking.priceCents;
    current.totalPaidCents += booking.paidCents;
    current.totalBalanceDueCents += booking.balanceDueCents;

    if (!current.latestAssets.includes(booking.billboardAsset.name) && current.latestAssets.length < 3) {
      current.latestAssets.push(booking.billboardAsset.name);
    }
  }

  const customerHistory = Array.from(customerHistoryMap.values()).sort(
    (left, right) =>
      right.latestStartsAt.getTime() - left.latestStartsAt.getTime() ||
      right.totalValueCents - left.totalValueCents ||
      left.customer.name.localeCompare(right.customer.name, "it")
  );

  return {
    assets,
    monthBookings,
    upcomingBookings,
    customerHistory
  };
}

export async function createBillboardBooking(input: CreateBillboardBookingInput) {
  if (input.endsAt.getTime() < input.startsAt.getTime()) {
    throw new Error("La data fine non puo essere precedente alla data inizio.");
  }

  const status = input.status || "CONFERMATO";
  const priceCents = Math.round(input.priceCents ?? 0);
  const paidCents = Math.round(input.paidCents ?? 0);
  const balanceDueCents = calculateBillboardBookingBalanceCents(priceCents, paidCents);

  if (priceCents < 0 || paidCents < 0) {
    throw new Error("Prezzo e incassato devono essere valori positivi.");
  }

  return prisma.$transaction(async (tx) => {
    const asset = await tx.billboardAsset.findUnique({
      where: { id: input.billboardAssetId }
    });

    if (!asset || !asset.active) {
      throw new Error("Impianto pubblicitario non trovato.");
    }

    const customer = await tx.customer.findUnique({
      where: { id: input.customerId }
    });

    if (!customer) {
      throw new Error("Cliente non trovato.");
    }

    if (reservesBillboardAsset(status)) {
      const overlappingBooking = await tx.billboardBooking.findFirst({
        where: {
          billboardAssetId: input.billboardAssetId,
          status: {
            not: "SCADUTO"
          },
          startsAt: {
            lte: input.endsAt
          },
          endsAt: {
            gte: input.startsAt
          }
        }
      });

      if (overlappingBooking) {
        throw new Error("Questo impianto e gia prenotato nel periodo indicato.");
      }
    }

    return tx.billboardBooking.create({
      data: {
        billboardAssetId: input.billboardAssetId,
        customerId: input.customerId,
        status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        priceCents,
        paidCents,
        balanceDueCents,
        note: input.note?.trim() || undefined,
        pdfFileName: input.pdf?.fileName,
        pdfFilePath: input.pdf?.filePath,
        pdfMimeType: input.pdf?.mimeType,
        pdfSizeBytes: input.pdf?.sizeBytes
      },
      include: {
        customer: true,
        billboardAsset: true
      }
    });
  });
}

export function getBillboardKindLabel(kind: BillboardAssetKind) {
  return billboardAssetKindLabels[kind];
}
