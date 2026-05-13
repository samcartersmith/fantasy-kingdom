import type { CatalogEvaluation } from "@/lib/trade-model/types";

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
  /** Best-effort age in years from Sleeper; players only. */
  age?: number | null;
  /** Sleeper in-app search rank when present (lower ≈ more searched). */
  sleeperSearchRank?: number | null;
  /** Recent add count from Sleeper trending (window set in API). */
  sleeperTrendingAdds?: number;
  /** Explainable model breakdown when the fair-trade model ran for this asset. */
  evaluation?: CatalogEvaluation;
};

export type LineItem = {
  lineId: string;
  assetId: string;
};

export const SUPERFLEX_QB_MULTIPLIER = 1.22;

/** Skill tokens that appear in catalog `position` strings (comma-separated). */
export type CatalogSkillPosition = "QB" | "RB" | "WR" | "TE";

/** True when catalog position string lists the given skill (e.g. `RB` or `WR,RB`). */
export function catalogPlayerHasSkillPosition(
  position: string | null,
  skill: CatalogSkillPosition,
): boolean {
  if (!position) return false;
  return position.split(",").some((p) => p.trim().toUpperCase() === skill);
}

/** True when catalog position string lists QB (e.g. `QB` or `QB,TE`). */
export function catalogPositionIncludesQb(position: string | null): boolean {
  return catalogPlayerHasSkillPosition(position, "QB");
}

export function effectiveValue(
  asset: CatalogAsset,
  options: { superflex: boolean; leagueFormatApplied?: boolean },
): number {
  if (options.leagueFormatApplied) {
    return asset.value;
  }
  if (
    options.superflex &&
    asset.kind === "player" &&
    catalogPositionIncludesQb(asset.position)
  ) {
    return Math.round(asset.value * SUPERFLEX_QB_MULTIPLIER);
  }
  return asset.value;
}
