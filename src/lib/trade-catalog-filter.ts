import type { CatalogAsset } from "@/lib/trade-types";
import { effectiveValue } from "@/lib/trade-types";

export type TradeCatalogEffOpts = { superflex: boolean; leagueFormatApplied?: boolean };

export type FilterTradeCatalogOptions = {
  /** When the query is blank, include draft picks + top players (trade calculator default). If false, return []. */
  includeEmptyQueryDefaults?: boolean;
  /** Max rows when the query is non-empty (default 40). */
  queryMatchCap?: number;
};

/**
 * Filters Sleeper/catalog assets for the trade UI (substring match on name, position, team, kind).
 * Optional blank-query “home” list (picks + top trade values) matches the main catalog panel.
 */
export function filterTradeCatalogSuggestions(
  catalog: CatalogAsset[],
  query: string,
  effOpts: TradeCatalogEffOpts,
  options: FilterTradeCatalogOptions = {},
): CatalogAsset[] {
  const includeEmptyDefaults = options.includeEmptyQueryDefaults !== false;
  const queryCap = options.queryMatchCap ?? 40;

  const q = query.trim().toLowerCase();
  if (!q) {
    if (!includeEmptyDefaults) return [];
    const picks = catalog.filter((a) => a.kind === "pick");
    const topPlayers = catalog
      .filter((a) => a.kind === "player")
      .sort((a, b) => {
        const vb = effectiveValue(b, effOpts);
        const va = effectiveValue(a, effOpts);
        if (vb !== va) return vb - va;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
    return [...picks, ...topPlayers];
  }

  const matches = catalog.filter((a) => {
    const blob = [a.name, a.position, a.team, a.kind]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
  matches.sort((a, b) => {
    const ap = a.kind === "pick" ? 0 : 1;
    const bp = b.kind === "pick" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, queryCap);
}
