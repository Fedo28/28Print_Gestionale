import { computeDiscountedUnitPrice } from "@/lib/pricing";

export const BILLBOARD_MIN_BOOKING_DAYS = 14;

export type BillboardPackagePresetValue = "PACK_3" | "PACK_10" | "RESELLER" | "CUSTOM";

export const BILLBOARD_PRICING_PRESETS: Record<
  BillboardPackagePresetValue | "SINGLE",
  {
    label: string;
    unitPriceCents: number;
    packageUnits: number | null;
    description: string;
  }
> = {
  SINGLE: {
    label: "Listino singolo",
    unitPriceCents: 25000,
    packageUnits: null,
    description: "Una plancia a 250 euro."
  },
  PACK_3: {
    label: "Pacchetto 3 plance",
    unitPriceCents: 20000,
    packageUnits: 3,
    description: "Tre crediti utilizzabili anche in periodi diversi."
  },
  PACK_10: {
    label: "Pacchetto 10 plance",
    unitPriceCents: 18000,
    packageUnits: 10,
    description: "Dieci crediti riutilizzabili su piu periodi."
  },
  RESELLER: {
    label: "Pacchetto rivenditore",
    unitPriceCents: 14000,
    packageUnits: null,
    description: "Prezzo dedicato con crediti configurabili."
  },
  CUSTOM: {
    label: "Pacchetto personalizzato",
    unitPriceCents: 25000,
    packageUnits: null,
    description: "Credito flessibile creato manualmente."
  }
};

export function getBillboardPresetMeta(preset: BillboardPackagePresetValue | "SINGLE") {
  return BILLBOARD_PRICING_PRESETS[preset];
}

export function getBillboardPackageLabel(
  preset: BillboardPackagePresetValue,
  sequence: number,
  purchasedUnits: number
) {
  if (preset === "PACK_3") {
    return `Pacchetto 3 plance #${sequence}`;
  }

  if (preset === "PACK_10") {
    return `Pacchetto 10 plance #${sequence}`;
  }

  if (preset === "RESELLER") {
    return `Pacchetto rivenditore #${sequence}`;
  }

  return `Pacchetto personalizzato #${sequence} (${purchasedUnits} crediti)`;
}

export function getSuggestedPackageUnits(
  preset: BillboardPackagePresetValue | "SINGLE",
  selectionCount: number
) {
  if (preset === "PACK_3") {
    return 3;
  }

  if (preset === "PACK_10") {
    return 10;
  }

  if (preset === "RESELLER" || preset === "CUSTOM") {
    return Math.max(1, selectionCount);
  }

  return Math.max(1, selectionCount);
}

export function computeBillboardUnitPriceCents(
  baseUnitPriceCents: number,
  discountMode: "NONE" | "AMOUNT" | "PERCENT",
  discountValue: number
) {
  return computeDiscountedUnitPrice(baseUnitPriceCents, discountMode, discountValue);
}

export function getBillboardBookingDurationDays(startKey: string, endKey: string) {
  if (!startKey || !endKey) {
    return 0;
  }

  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
}

export function addDaysToDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
