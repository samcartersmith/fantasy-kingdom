import type { CatalogAsset } from "@/lib/trade-types";
import type { SleeperNflPlayersMap } from "@/lib/sleeper-types";
import {
  getSkillFantasyPositions,
  skillPositionsDisplay,
  sleeperDisplayName,
  tradeValueFromSleeperSignals,
} from "@/lib/sleeper-ranking";

/**
 * Turns Sleeper's full NFL players map into slim catalog rows for the trade UI.
 * Only includes active NFL athletes with numeric Sleeper ids (excludes stray map keys).
 * Only skill positions (QB, RB, WR, TE), including multi-eligible players.
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

    const skillPos = getSkillFantasyPositions(raw);
    if (skillPos.length === 0) continue;

    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const ta = trendingAdds.get(String(pid)) ?? 0;
    const value = tradeValueFromSleeperSignals(sr, ta);
    const pidStr = String(pid);

    out.push({
      id: `sleeper_${pidStr}`,
      kind: "player",
      name: sleeperDisplayName(raw),
      position: skillPositionsDisplay(skillPos),
      team,
      value,
      sleeperPlayerId: pidStr,
      imageUrl: `https://sleepercdn.com/content/nfl/players/${pidStr}.jpg`,
      sleeperSearchRank: sr,
      sleeperTrendingAdds: ta,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
