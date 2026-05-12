export type AssetKind = "player" | "pick";

export type CatalogAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  /** Sleeper in-app search rank when present (lower ≈ more searched). */
  sleeperSearchRank?: number | null;
  /** Recent add count from Sleeper trending (window set in API). */
  sleeperTrendingAdds?: number;
};

export type LineItem = {
  lineId: string;
  assetId: string;
};

export const SUPERFLEX_QB_MULTIPLIER = 1.22;

export function effectiveValue(
  asset: CatalogAsset,
  options: { superflex: boolean },
): number {
  if (options.superflex && asset.kind === "player" && asset.position === "QB") {
    return Math.round(asset.value * SUPERFLEX_QB_MULTIPLIER);
  }
  return asset.value;
}
