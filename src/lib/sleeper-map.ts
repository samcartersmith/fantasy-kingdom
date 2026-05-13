import type { CatalogAsset } from "@/lib/trade-types";
import type { SleeperNflPlayersMap } from "@/lib/sleeper-types";
import {
  getSkillFantasyPositions,
  skillPositionsDisplay,
  sleeperDisplayName,
  tradeValueFromSleeperSignals,
} from "@/lib/sleeper-ranking";
import { resolvePlayerAgeYears } from "@/lib/trade-model/age-curve";
import type { FpScoringContext } from "@/lib/trade-model/fp-baseline";
import { scorePlayer } from "@/lib/trade-model/score-player";
import type { LeagueContext, TradeModelProviders } from "@/lib/trade-model/types";

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

/**
 * Same catalog rows as {@link sleeperPlayersMapToCatalog}, but `value` uses the explainable
 * fair-trade model: fantasy production snapshot (primary) plus curated factors, capped buzz, and league context.
 */
export function sleeperPlayersMapToCatalogModeled(
  map: SleeperNflPlayersMap,
  trendingAdds: Map<string, number>,
  providers: TradeModelProviders,
  league: LeagueContext,
  fp: FpScoringContext,
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
    const pidStr = String(pid);
    const position = skillPositionsDisplay(skillPos);
    const age = resolvePlayerAgeYears(raw.age, raw.years_exp);

    const scored = scorePlayer(
      {
        sleeperPlayerId: pidStr,
        teamAbbr: team,
        positionLabel: position,
        searchRank: sr,
        trendingAdds: ta,
        age,
        yearsExp: typeof raw.years_exp === "number" && Number.isFinite(raw.years_exp) ? raw.years_exp : null,
      },
      providers,
      league,
      fp,
    );

    out.push({
      id: `sleeper_${pidStr}`,
      kind: "player",
      name: sleeperDisplayName(raw),
      position,
      team,
      value: scored.value,
      sleeperPlayerId: pidStr,
      imageUrl: `https://sleepercdn.com/content/nfl/players/${pidStr}.jpg`,
      sleeperSearchRank: sr,
      sleeperTrendingAdds: ta,
      evaluation: { confidence01: scored.confidence01, components: scored.components },
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
