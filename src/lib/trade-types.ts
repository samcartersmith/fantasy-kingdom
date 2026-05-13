export type AssetKind = "player" | "pick";

export type CatalogAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  /** Numeric Sleeper player id when `kind === "player"`. */
  sleeperPlayerId?: string;
  /** Headshot URL from Sleeper CDN; players only. */
  imageUrl?: string | null;
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

/** True when catalog position string lists QB (e.g. `QB` or `QB,TE`). */
export function catalogPositionIncludesQb(position: string | null): boolean {
  if (!position) return false;
  return position.split(",").some((p) => p.trim().toUpperCase() === "QB");
}

export function effectiveValue(
  asset: CatalogAsset,
  options: { superflex: boolean },
): number {
  if (
    options.superflex &&
    asset.kind === "player" &&
    catalogPositionIncludesQb(asset.position)
  ) {
    return Math.round(asset.value * SUPERFLEX_QB_MULTIPLIER);
  }
  return asset.value;
}
