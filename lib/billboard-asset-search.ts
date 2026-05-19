import { BillboardAssetKind } from "@prisma/client";
import { billboardAssetKindLabels } from "@/lib/constants";
import { createSearchIndexValue, createSearchMatcher, getSearchFieldScore, matchesSearchIndexValue, normalizeSearchText } from "@/lib/search-text";

export type SearchableBillboardAsset = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
};

export function normalizeBillboardAssetSearchValue(value: string) {
  return normalizeSearchText(value);
}

function buildBillboardAssetHaystack(asset: SearchableBillboardAsset) {
  return createSearchIndexValue(
    [
      asset.name,
      asset.code,
      asset.location || "",
      billboardAssetKindLabels[asset.kind]
    ].join(" ")
  );
}

function withWeight(score: number | null, weight: number) {
  return score === null ? Number.MAX_SAFE_INTEGER : score + weight;
}

export function getBillboardAssetSearchScore(asset: SearchableBillboardAsset, normalizedQuery: string) {
  const matcher = createSearchMatcher(normalizedQuery);

  if (!matchesSearchIndexValue(buildBillboardAssetHaystack(asset), matcher)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(
    withWeight(getSearchFieldScore(asset.name, matcher), 0),
    withWeight(getSearchFieldScore(asset.code, matcher), 10),
    withWeight(getSearchFieldScore(asset.location || "", matcher), 20),
    withWeight(getSearchFieldScore(billboardAssetKindLabels[asset.kind], matcher), 28)
  );
}

export function rankBillboardAssets<T extends SearchableBillboardAsset>(assets: T[], query: string) {
  const normalizedQuery = normalizeBillboardAssetSearchValue(query);

  if (!normalizedQuery) {
    return assets;
  }

  return assets
    .map((asset) => ({
      asset,
      score: getBillboardAssetSearchScore(asset, normalizedQuery)
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.asset.name.localeCompare(right.asset.name, "it") ||
        left.asset.code.localeCompare(right.asset.code, "it")
    )
    .map((entry) => entry.asset);
}
