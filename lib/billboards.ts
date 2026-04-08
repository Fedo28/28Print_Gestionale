import { BillboardAssetKind } from "@prisma/client";
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
  startsAt: Date;
  endsAt: Date;
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

  const [assets, monthBookings, upcomingBookings] = await Promise.all([
    prisma.billboardAsset.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        bookings: {
          where: {
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
    })
  ]);

  return {
    assets,
    monthBookings,
    upcomingBookings
  };
}

export async function createBillboardBooking(input: CreateBillboardBookingInput) {
  if (input.endsAt.getTime() < input.startsAt.getTime()) {
    throw new Error("La data fine non puo essere precedente alla data inizio.");
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

    const overlappingBooking = await tx.billboardBooking.findFirst({
      where: {
        billboardAssetId: input.billboardAssetId,
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

    return tx.billboardBooking.create({
      data: {
        billboardAssetId: input.billboardAssetId,
        customerId: input.customerId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
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
  switch (kind) {
    case "MONITOR":
      return "Monitor";
    case "VELA_ITINERANTE":
      return "Vela itinerante";
    default:
      return "Cartellone";
  }
}
