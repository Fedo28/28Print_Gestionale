import { BillboardAssetKind, BillboardBookingStatus, CustomerType, Prisma } from "@prisma/client";
import { billboardAssetKindLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type BillboardPdfUpload = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
};

export type CreateBillboardBookingInput = {
  billboardAssetId?: string;
  billboardAssetIds?: string[];
  monitorSlotsByAssetId?: Record<string, number | null | undefined>;
  customerId?: string;
  customer?: {
    type?: CustomerType;
    name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    pec?: string;
    taxCode?: string;
    vatNumber?: string;
    uniqueCode?: string;
    notes?: string;
  };
  status?: BillboardBookingStatus;
  startsAt: Date;
  endsAt: Date;
  priceCents?: number;
  paidCents?: number;
  note?: string;
  pdf?: BillboardPdfUpload | null;
};

export type UpdateBillboardBookingInput = {
  id: string;
  billboardAssetId: string;
  monitorSlot?: number | null;
  customerId?: string;
  customer?: {
    type?: CustomerType;
    name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    pec?: string;
    taxCode?: string;
    vatNumber?: string;
    uniqueCode?: string;
    notes?: string;
  };
  startsAt: Date;
  endsAt: Date;
  priceCents?: number;
  paidCents?: number;
  note?: string;
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

export function getBillboardAssetCapacity(kind: BillboardAssetKind) {
  return kind === "MONITOR" ? 6 : 1;
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
  const activeAssetsCount = await prisma.billboardAsset.count({
    where: {
      active: true
    }
  });

  if (activeAssetsCount === 0) {
    await ensureBillboardAssets();
  }

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);

  const [assets, monthBookings] = await Promise.all([
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
          orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
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
    })
  ]);

  return {
    assets,
    monthBookings
  };
}

export async function createBillboardBooking(input: CreateBillboardBookingInput) {
  const bookings = await createBillboardBookings(input);
  return bookings[0];
}

export async function createBillboardBookings(input: CreateBillboardBookingInput) {
  if (input.endsAt.getTime() < input.startsAt.getTime()) {
    throw new Error("La data fine non puo essere precedente alla data inizio.");
  }

  const status = input.status || "CONFERMATO";
  const priceCents = Math.round(input.priceCents ?? 0);
  const paidCents = Math.round(input.paidCents ?? 0);
  const balanceDueCents = calculateBillboardBookingBalanceCents(priceCents, paidCents);
  const monitorSlotsByAssetId = input.monitorSlotsByAssetId || {};
  const assetIds = Array.from(
    new Set(
      (input.billboardAssetIds && input.billboardAssetIds.length > 0 ? input.billboardAssetIds : [input.billboardAssetId || ""])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (priceCents < 0 || paidCents < 0) {
    throw new Error("Prezzo e incassato devono essere valori positivi.");
  }

  if (assetIds.length === 0) {
    throw new Error("Impianto pubblicitario non trovato.");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await ensureBillboardCustomer(tx, input);
    const assets = await tx.billboardAsset.findMany({
      where: {
        id: {
          in: assetIds
        }
      }
    });

    if (assets.length !== assetIds.length || assets.some((asset) => !asset.active)) {
      throw new Error("Impianto pubblicitario non trovato.");
    }

    const createdBookings = [];

    for (const assetId of assetIds) {
      const asset = assets.find((entry) => entry.id === assetId);
      if (!asset) {
        throw new Error("Impianto pubblicitario non trovato.");
      }

      if (reservesBillboardAsset(status)) {
        const overlappingBookings = await tx.billboardBooking.findMany({
          where: {
            billboardAssetId: assetId,
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

        const capacity = getBillboardAssetCapacity(asset.kind);
        if (asset.kind === "MONITOR") {
          const requestedSlot = monitorSlotsByAssetId[assetId] ?? null;
          const occupiedSlots = new Set(
            overlappingBookings
              .map((booking) => booking.monitorSlot)
              .filter((slot): slot is number => typeof slot === "number" && slot >= 1 && slot <= 6)
          );
          const firstFreeSlot = [1, 2, 3, 4, 5, 6].find((slot) => !occupiedSlots.has(slot)) ?? null;

          if (requestedSlot !== null) {
            if (requestedSlot < 1 || requestedSlot > 6) {
              throw new Error("Lo slot del monitor non e valido.");
            }

            if (occupiedSlots.has(requestedSlot)) {
              throw new Error(`Lo slot ${requestedSlot} di questo monitor e gia occupato nel periodo indicato.`);
            }
          } else if (overlappingBookings.length >= capacity) {
            throw new Error("Questo monitor ha gia occupato tutti e 6 gli spazi nel periodo indicato.");
          }

          monitorSlotsByAssetId[assetId] = requestedSlot ?? firstFreeSlot;
        } else if (overlappingBookings.length >= capacity) {
          throw new Error("Questo impianto e gia prenotato nel periodo indicato.");
        }
      }

      const resolvedMonitorSlot =
        asset.kind === "MONITOR" ? Math.max(1, Math.min(6, monitorSlotsByAssetId[assetId] ?? 1)) : null;

      const created = await tx.billboardBooking.create({
        data: {
          billboardAssetId: assetId,
          customerId: customer.id,
          status,
          monitorSlot: resolvedMonitorSlot,
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

      createdBookings.push(created);
    }

    return createdBookings;
  });
}

export async function updateBillboardBooking(input: UpdateBillboardBookingInput) {
  if (input.endsAt.getTime() < input.startsAt.getTime()) {
    throw new Error("La data fine non puo essere precedente alla data inizio.");
  }

  const priceCents = Math.round(input.priceCents ?? 0);
  const paidCents = Math.round(input.paidCents ?? 0);
  const balanceDueCents = calculateBillboardBookingBalanceCents(priceCents, paidCents);

  if (priceCents < 0 || paidCents < 0) {
    throw new Error("Prezzo e incassato devono essere valori positivi.");
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.billboardBooking.findUnique({
      where: { id: input.id },
      include: {
        billboardAsset: true
      }
    });

    if (!booking) {
      throw new Error("Prenotazione non trovata.");
    }

    const asset = await tx.billboardAsset.findUnique({
      where: { id: input.billboardAssetId }
    });

    if (!asset || !asset.active) {
      throw new Error("Impianto pubblicitario non trovato.");
    }

    const customer = await ensureBillboardCustomer(tx, input);

    if (reservesBillboardAsset(booking.status)) {
      const overlappingBookings = await tx.billboardBooking.findMany({
        where: {
          id: { not: booking.id },
          billboardAssetId: asset.id,
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

      const capacity = getBillboardAssetCapacity(asset.kind);
      if (asset.kind === "MONITOR") {
        const requestedSlot = input.monitorSlot ?? null;
        const occupiedSlots = new Set(
          overlappingBookings
            .map((entry) => entry.monitorSlot)
            .filter((slot): slot is number => typeof slot === "number" && slot >= 1 && slot <= 6)
        );
        const firstFreeSlot = [1, 2, 3, 4, 5, 6].find((slot) => !occupiedSlots.has(slot)) ?? null;

        if (requestedSlot !== null) {
          if (requestedSlot < 1 || requestedSlot > 6) {
            throw new Error("Lo slot del monitor non e valido.");
          }

          if (occupiedSlots.has(requestedSlot)) {
            throw new Error(`Lo slot ${requestedSlot} di questo monitor e gia occupato nel periodo indicato.`);
          }
        } else if (overlappingBookings.length >= capacity) {
          throw new Error("Questo monitor ha gia occupato tutti e 6 gli spazi nel periodo indicato.");
        }

        input.monitorSlot = requestedSlot ?? firstFreeSlot;
      } else if (overlappingBookings.length >= capacity) {
        throw new Error("Questo impianto e gia prenotato nel periodo indicato.");
      }
    }

    const resolvedMonitorSlot =
      asset.kind === "MONITOR" ? Math.max(1, Math.min(6, input.monitorSlot ?? 1)) : null;

    return tx.billboardBooking.update({
      where: { id: booking.id },
      data: {
        billboardAssetId: asset.id,
        customerId: customer.id,
        monitorSlot: resolvedMonitorSlot,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        priceCents,
        paidCents,
        balanceDueCents,
        note: input.note?.trim() || undefined
      },
      include: {
        customer: true,
        billboardAsset: true
      }
    });
  });
}

export async function deleteBillboardBooking(id: string) {
  return prisma.billboardBooking.delete({
    where: { id },
    include: {
      customer: true,
      billboardAsset: true
    }
  });
}

async function ensureBillboardCustomer(
  tx: Prisma.TransactionClient,
  input: Pick<CreateBillboardBookingInput, "customerId" | "customer"> | Pick<UpdateBillboardBookingInput, "customerId" | "customer">
) {
  if (input.customerId) {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new Error("Cliente selezionato non trovato.");
    }

    return customer;
  }

  const name = input.customer?.name?.trim();
  const phone = input.customer?.phone?.trim();

  if (!name) {
    throw new Error("Per creare un nuovo cliente serve il nome.");
  }

  return tx.customer.create({
    data: {
      name,
      type: input.customer?.type ?? "PUBBLICO",
      phone: phone || undefined,
      whatsapp: input.customer?.whatsapp?.trim() || undefined,
      email: input.customer?.email?.trim() || undefined,
      pec: input.customer?.pec?.trim() || undefined,
      taxCode: input.customer?.taxCode?.trim() || undefined,
      vatNumber: input.customer?.vatNumber?.trim() || undefined,
      uniqueCode: input.customer?.uniqueCode?.trim() || undefined,
      notes: input.customer?.notes?.trim() || undefined
    }
  });
}

export function getBillboardKindLabel(kind: BillboardAssetKind) {
  return billboardAssetKindLabels[kind];
}
