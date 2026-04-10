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

type BillboardAssetSeedDefinition = {
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location: string | null;
  sortOrder: number;
  legacyCodes?: readonly string[];
};

const CARTELLONE_DEFINITIONS = [
  {
    code: "1001",
    name: "1001 - Zona PAM Via Nomentana",
    location: "Mentana (RM) - incrocio Via S. Pertini - 4x3 m - 42.047301, 12.626579"
  },
  {
    code: "1002",
    name: "1002 - Zona PAM Via Nomentana",
    location: "Mentana (RM) - incrocio Via S. Pertini - 4x3 m - 42.047301, 12.626579"
  },
  {
    code: "1003",
    name: "1003 - Zona PAM Via Nomentana",
    location: "Mentana (RM) - incrocio Via S. Pertini - 4x3 m - 42.047301, 12.626579"
  },
  {
    code: "1004",
    name: "1004 - Zona PAM Via Nomentana",
    location: "Monterotondo (RM) - Zona PAM, Via Nomentana - 4x3 m - 42.047625, 12.625814"
  },
  {
    code: "1005",
    name: "1005 - Via Monghio",
    location: "Monterotondo (RM) - Via Monghio - 4x3 m - 42.057751, 12.622420"
  },
  {
    code: "1006",
    name: "1006 - Via Monghio",
    location: "Monterotondo (RM) - Via Monghio - 4x3 m - 42.057751, 12.622420"
  },
  {
    code: "1007",
    name: "1007 - Via dello Stadio",
    location: "Monterotondo (RM) - Via dello Stadio - 4x3 m - 42.058442, 12.621975"
  },
  {
    code: "1008",
    name: "1008 - Via dello Stadio (altezza Bar La Fonte)",
    location: "Monterotondo (RM) - Via dello Stadio - 4x3 m - 42.059587, 12.622877"
  },
  {
    code: "1009",
    name: "1009 - Incrocio Via Reatina / Via C. Chiodato",
    location: "Monterotondo (RM) - incrocio Via Reatina e Via C. Chiodato - 4x3 m - 42.056776, 12.651220"
  },
  {
    code: "1010",
    name: "1010 - Incrocio Via S. Pertini / Via C. Chiodato",
    location: "Monterotondo (RM) - incrocio Via S. Pertini e Via C. Chiodato - 3x2 m - 42.055779, 12.635404"
  },
  {
    code: "1011",
    name: "1011 - Incrocio Via S. Pertini / Via C. Chiodato",
    location: "Monterotondo (RM) - incrocio Via S. Pertini e Via C. Chiodato - 3x2 m - 42.055779, 12.635404"
  },
  {
    code: "1012",
    name: "1012 - Via delle Fornaci dir. Roma",
    location: "Monterotondo (RM) - Via delle Fornaci dir. Roma - 4x3 m - 42.041644, 12.591653"
  },
  {
    code: "1013",
    name: "1013 - Via delle Fornaci dir. Monterotondo",
    location: "Monterotondo (RM) - Via delle Fornaci dir. Monterotondo - 4x3 m - 42.041644, 12.591653"
  },
  {
    code: "1014",
    name: "1014 - Incrocio Via delle Fornaci",
    location: "Monterotondo (RM) - incrocio Via delle Fornaci - 4x3 m - 42.040615, 12.590260"
  },
  {
    code: "1015",
    name: "1015 - Incrocio Via delle Fornaci",
    location: "Monterotondo (RM) - incrocio Via delle Fornaci - 4x3 m - 42.040615, 12.590260"
  },
  {
    code: "1016",
    name: "1016 - Ponte del Grillo Monofacciale",
    location: "Monterotondo (RM) - Rotatoria Ponte del Grillo - 3x2 m monofacciale - 42.083306, 12.605485"
  },
  {
    code: "1017",
    name: "1017 - Ponte del Grillo Bifacciale",
    location: "Monterotondo (RM) - Rotatoria Ponte del Grillo - 3x2 m bifacciale - 42.083306, 12.605485"
  },
  {
    code: "1018",
    name: "1018 - Ponte del Grillo Bifacciale",
    location: "Monterotondo (RM) - Rotatoria Ponte del Grillo - 3x2 m bifacciale - 42.083306, 12.605485"
  },
  {
    code: "1019",
    name: "1019 - Via Nomentana Casali",
    location: "Mentana (RM) - Via Nomentana Casali - 3x2 m - 42.022003, 12.647169"
  },
  {
    code: "1022",
    name: "1022 - Rotatoria Via F. del Solco",
    location: "Fiano Romano (RM) - Rotatoria Via F. del Solco - 3x2 m - 42.139993, 12.595862"
  },
  {
    code: "1023",
    name: "1023 - Via F. del Solco Bifacciale",
    location: "Fiano Romano (RM) - Via F. del Solco - 3x2 m bifacciale - 42.140083, 12.591419"
  },
  {
    code: "1024",
    name: "1024 - Via F. del Solco Bifacciale",
    location: "Fiano Romano (RM) - Via F. del Solco - 3x2 m bifacciale - 42.140083, 12.591419"
  },
  {
    code: "1025",
    name: "1025 - Via P. Togliatti Bifacciale",
    location: "Fiano Romano (RM) - Via P. Togliatti - 3x2 m bifacciale - 42.164426, 12.590808"
  },
  {
    code: "1026",
    name: "1026 - Via P. Togliatti Bifacciale",
    location: "Fiano Romano (RM) - Via P. Togliatti - 3x2 m bifacciale - 42.164426, 12.590808"
  }
] as const;

export const DEFAULT_BILLBOARD_ASSET_DEFINITIONS: readonly BillboardAssetSeedDefinition[] = [
  ...CARTELLONE_DEFINITIONS.map((asset, index) => ({
    ...asset,
    kind: "CARTELLONE" as const,
    sortOrder: index + 1,
    legacyCodes: [`CARTELLONE_${String(index + 1).padStart(2, "0")}`]
  })),
  {
    code: "MONITOR_01",
    name: "Monitor",
    kind: "MONITOR" as const,
    location: null,
    sortOrder: 25
  },
  {
    code: "VELA_01",
    name: "Vela itinerante",
    kind: "VELA_ITINERANTE" as const,
    location: null,
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
    code: asset.code,
    name: asset.name,
    kind: asset.kind,
    location: asset.location,
    sortOrder: asset.sortOrder,
    active: true
  }));
}

export async function ensureBillboardAssets() {
  const definitions = DEFAULT_BILLBOARD_ASSET_DEFINITIONS;
  const existing = await prisma.billboardAsset.findMany({
    include: {
      _count: {
        select: {
          bookings: true
        }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  const existingByCode = new Map(existing.map((asset) => [asset.code, asset]));
  const matchedIds = new Set<string>();

  for (const definition of definitions) {
    const directMatch = existingByCode.get(definition.code);
    const legacyMatch = (definition.legacyCodes || [])
      .map((legacyCode) => existingByCode.get(legacyCode))
      .find((asset): asset is (typeof existing)[number] => asset !== undefined && !matchedIds.has(asset.id));
    const asset = directMatch || legacyMatch;

    if (!asset) {
      await prisma.billboardAsset.create({
        data: {
          code: definition.code,
          name: definition.name,
          kind: definition.kind,
          location: definition.location,
          sortOrder: definition.sortOrder,
          active: true
        }
      });
      continue;
    }

    matchedIds.add(asset.id);

    await prisma.billboardAsset.update({
      where: {
        id: asset.id
      },
      data: {
        code: definition.code,
        name: definition.name,
        kind: definition.kind,
        location: definition.location,
        sortOrder: definition.sortOrder,
        active: true
      }
    });
  }

  const canonicalCodes = new Set(definitions.map((definition) => definition.code));
  const extraAssets = existing.filter((asset) => !matchedIds.has(asset.id) && !canonicalCodes.has(asset.code));

  for (const asset of extraAssets) {
    if (asset._count.bookings === 0) {
      await prisma.billboardAsset.delete({
        where: {
          id: asset.id
        }
      });
      continue;
    }

    await prisma.billboardAsset.update({
      where: {
        id: asset.id
      },
      data: {
        active: false
      }
    });
  }
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
    historyBookings,
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
