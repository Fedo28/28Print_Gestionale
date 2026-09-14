import {
  type CatalogPriceMode,
  type DiscountModeValue,
  clampDiscountValue,
  computeEffectiveUnitPriceCents,
  computeLineTotalWithAdjustmentsCents,
  formatDiscountSummary,
  formatExtraSummary,
  normalizeQuantityValue,
  parseQuantityTiers
} from "@/lib/pricing";
import { resolveServiceCatalogPriceMode } from "@/lib/domain/catalog/service-catalog";

type QuoteableServiceCatalog = {
  id?: string;
  code?: string | null;
  name?: string | null;
  basePriceCents: number;
  quantityTiers?: string | null;
};

type QuantityTierSnapshot = {
  minQuantity: number;
  maxQuantity: number | null;
  unitPriceCents: number;
} | null;

export type CatalogServiceQuoteInput = {
  service: QuoteableServiceCatalog;
  quantity: number;
  explicitMode?: CatalogPriceMode;
  format?: string | null;
  discountMode?: DiscountModeValue;
  discountValue?: number;
  extraMode?: DiscountModeValue;
  extraValue?: number;
};

export type CatalogServiceQuote = {
  quantity: number;
  catalogBasePriceCents: number;
  catalogPriceMode: CatalogPriceMode;
  discountMode: DiscountModeValue;
  discountValue: number;
  extraMode: DiscountModeValue;
  extraValue: number;
  unitPriceCents: number;
  lineTotalCents: number;
  pricingSource: "base_price" | "quantity_tier";
  quantityTier: QuantityTierSnapshot;
  discountSummary: string;
  extraSummary: string;
};

export type CatalogServicePricingSnapshot = {
  serviceCatalogId: string | null;
  serviceCatalogCode: string | null;
  serviceCatalogName: string | null;
  quantity: number;
  catalogBasePriceCents: number;
  catalogPriceMode: CatalogPriceMode;
  discountMode: DiscountModeValue;
  discountValue: number;
  extraMode: DiscountModeValue;
  extraValue: number;
  unitPriceCents: number;
  lineTotalCents: number;
  pricingSource: CatalogServiceQuote["pricingSource"];
  quantityTier: QuantityTierSnapshot;
};

function resolveMatchedQuantityTier(quantity: number, quantityTiers: string | null | undefined): QuantityTierSnapshot {
  if (!quantityTiers?.trim()) {
    return null;
  }

  const tiers = parseQuantityTiers(quantityTiers);
  return (
    tiers.find((tier) => quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity)) || null
  );
}

function normalizeCatalogBasePriceCents(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function quoteCatalogService(input: CatalogServiceQuoteInput): CatalogServiceQuote {
  const quantity = normalizeQuantityValue(input.quantity, 1);
  const quantityTier = resolveMatchedQuantityTier(quantity, input.service.quantityTiers);
  const catalogBasePriceCents = quantityTier
    ? quantityTier.unitPriceCents
    : normalizeCatalogBasePriceCents(input.service.basePriceCents);
  const catalogPriceMode = resolveServiceCatalogPriceMode({
    explicitMode: input.explicitMode,
    format: input.format,
    serviceCatalogCode: input.service.code,
    serviceCatalogName: input.service.name
  });
  const discountMode = input.discountMode || "NONE";
  const discountValue = clampDiscountValue(discountMode, Number(input.discountValue ?? 0));
  const extraMode = input.extraMode || "NONE";
  const extraValue = clampDiscountValue(extraMode, Number(input.extraValue ?? 0));
  const lineTotalCents = computeLineTotalWithAdjustmentsCents(
    catalogBasePriceCents,
    quantity,
    discountMode,
    discountValue,
    extraMode,
    extraValue,
    catalogPriceMode
  );

  return {
    quantity,
    catalogBasePriceCents,
    catalogPriceMode,
    discountMode,
    discountValue,
    extraMode,
    extraValue,
    unitPriceCents: computeEffectiveUnitPriceCents(lineTotalCents, quantity),
    lineTotalCents,
    pricingSource: quantityTier ? "quantity_tier" : "base_price",
    quantityTier,
    discountSummary: formatDiscountSummary(discountMode, discountValue),
    extraSummary: formatExtraSummary(extraMode, extraValue)
  };
}

export function buildCatalogServicePricingSnapshot(input: CatalogServiceQuoteInput): CatalogServicePricingSnapshot {
  const quote = quoteCatalogService(input);

  return {
    serviceCatalogId: input.service.id?.trim() || null,
    serviceCatalogCode: input.service.code?.trim() || null,
    serviceCatalogName: input.service.name?.trim() || null,
    quantity: quote.quantity,
    catalogBasePriceCents: quote.catalogBasePriceCents,
    catalogPriceMode: quote.catalogPriceMode,
    discountMode: quote.discountMode,
    discountValue: quote.discountValue,
    extraMode: quote.extraMode,
    extraValue: quote.extraValue,
    unitPriceCents: quote.unitPriceCents,
    lineTotalCents: quote.lineTotalCents,
    pricingSource: quote.pricingSource,
    quantityTier: quote.quantityTier
  };
}
