import type { CatalogAsset } from "@/lib/trade-types";
import type { SleeperNflPlayersMap } from "@/lib/sleeper-types";
import {
  fantasyPrimary,
  sleeperDisplayName,
  tradeValueFromSleeperSignals,
} from "@/lib/sleeper-ranking";

/**
 * Turns Sleeper's full NFL players map into slim catalog rows for the trade UI.
 * Only includes active NFL athletes with numeric Sleeper ids (excludes stray map keys).
 * `value` uses Sleeper `search_rank` + trending add counts (see sleeper-ranking.ts).
 */
export function sleeperPlayersMapToCatalog(
  map: SleeperNflPlayersMap,
  trendingAdds: Map<string, number>,
): CatalogAsset[] {
  const out: CatalogAsset[] = [];

  for (const [key, raw] of Object.entries(map)) {
    if (!raw || typeof raw !== "object") continue;
    const pid = raw.player_id ?? key;
    if (!/^\d+$/.test(String(pid))) continue;
    if (raw.sport && raw.sport !== "nfl") continue;
    if (raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;

    const pos = fantasyPrimary(raw);
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const ta = trendingAdds.get(String(pid)) ?? 0;
    const value = tradeValueFromSleeperSignals(sr, ta);

    out.push({
      id: `sleeper_${pid}`,
      kind: "player",
      name: sleeperDisplayName(raw),
      position: pos,
      team,
      value,
      sleeperPlayerId: String(pid),
      sleeperSearchRank: sr,
      sleeperTrendingAdds: ta,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
