import { BillboardAssetKind } from "@prisma/client";
import { billboardAssetKindLabels } from "@/lib/constants";

export type SearchableBillboardAsset = {
  id: string;
  code: string;
  name: string;
  kind: BillboardAssetKind;
  location?: string | null;
};

export function normalizeBillboardAssetSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildBillboardAssetHaystack(asset: SearchableBillboardAsset) {
  return normalizeBillboardAssetSearchValue(
    [
      asset.name,
      asset.code,
      asset.location || "",
      billboardAssetKindLabels[asset.kind]
    ].join(" ")
  );
}

export function getBillboardAssetSearchScore(asset: SearchableBillboardAsset, normalizedQuery: string) {
  const haystack = buildBillboardAssetHaystack(asset);
  const normalizedName = normalizeBillboardAssetSearchValue(asset.name);
  const normalizedCode = normalizeBillboardAssetSearchValue(asset.code);
  const normalizedLocation = normalizeBillboardAssetSearchValue(asset.location || "");
  const normalizedKind = normalizeBillboardAssetSearchValue(billboardAssetKindLabels[asset.kind]);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.length || !terms.every((term) => haystack.includes(term))) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  if (normalizedCode === normalizedQuery) {
    return 3;
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 4;
  }

  if (normalizedLocation === normalizedQuery) {
    return 5;
  }

  if (normalizedLocation.includes(normalizedQuery)) {
    return 6;
  }

  if (normalizedKind.startsWith(normalizedQuery) || normalizedKind.includes(normalizedQuery)) {
    return 7;
  }

  return 8;
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
