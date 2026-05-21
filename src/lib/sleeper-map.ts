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
import type { EvaluationComponent, LeagueContext, TradeModelProviders } from "@/lib/trade-model/types";

export type TradeCalculatorDisplayAnchor = {
  vmin: number;
  vmax: number;
  span: number;
};

export function tradeCalculatorDisplayAnchorFromRaws(raws: number[]): TradeCalculatorDisplayAnchor {
  if (raws.length === 0) {
    return { vmin: 0, vmax: 0, span: 0 };
  }
  const vmin = Math.min(...raws);
  const vmax = Math.max(...raws);
  return { vmin, vmax, span: vmax - vmin };
}

/** Maps one raw model total to 0–10,000 using the same anchor as the trade calculator catalog. */
export function rawTradeValueToCalculatorDisplay(
  raw: number,
  anchor: TradeCalculatorDisplayAnchor,
): number {
  if (anchor.span <= 0) return 5000;
  return Math.round((10_000 * (raw - anchor.vmin)) / anchor.span);
}

/**
 * Maps raw internal trade totals (same request cohort) to 0–10,000 display values; scales breakdown lines.
 */
function mapCatalogPlayerValuesToDisplayScale(
  rows: Array<{ base: Omit<CatalogAsset, "value" | "evaluation">; rawValue: number; confidence01: number; components: EvaluationComponent[] }>,
): CatalogAsset[] {
  if (rows.length === 0) return [];
  const anchor = tradeCalculatorDisplayAnchorFromRaws(rows.map((r) => r.rawValue));

  return rows.map(({ base, rawValue, confidence01, components }) => {
    const display = rawTradeValueToCalculatorDisplay(rawValue, anchor);
    const factor = rawValue !== 0 ? display / rawValue : 1;
    const scaled: EvaluationComponent[] = components.map((c) => ({
      ...c,
      contribution: Math.round(c.contribution * factor),
    }));
    const sumScaled = scaled.reduce((a, c) => a + c.contribution, 0);
    const drift = display - sumScaled;
    if (scaled.length > 0 && drift !== 0) {
      const ix = Math.max(
        0,
        scaled.findIndex((c) => c.key === "fantasyProduction"),
      );
      scaled[ix] = {
        ...scaled[ix]!,
        contribution: scaled[ix]!.contribution + drift,
      };
    }
    return {
      ...base,
      value: display,
      evaluation: { confidence01, components: scaled },
    };
  });
}

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
    const age = resolvePlayerAgeYears(raw.age, raw.years_exp);

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
      age,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Same catalog rows as {@link sleeperPlayersMapToCatalog}, but `value` uses the explainable
 * fair-trade model: composite rank spine + merged VBD, curated factors, capped buzz, league context.
 * Player `value` is scaled to **0–10,000** across the returned cohort (single API response).
 */
export type ModeledPlayerCatalogBuild = {
  assets: CatalogAsset[];
  displayAnchor: TradeCalculatorDisplayAnchor;
};

/** Score one Sleeper player with the trade model (no active-roster filter). */
export function scoreSleeperPlayerRawTradeValue(
  raw: SleeperNflPlayersMap[string],
  trendingAdds: Map<string, number>,
  providers: TradeModelProviders,
  league: LeagueContext,
  fp: FpScoringContext,
  nflDraftRoundBySleeperId: Record<string, number>,
): number | null {
  if (!raw || typeof raw !== "object") return null;
  const pid = String(raw.player_id ?? "");
  if (!/^\d+$/.test(pid)) return null;
  if (raw.sport && raw.sport !== "nfl") return null;

  const skillPos = getSkillFantasyPositions(raw);
  if (skillPos.length === 0) return null;

  const sr =
    typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
      ? raw.search_rank
      : null;
  const ta = trendingAdds.get(pid) ?? 0;
  const position = skillPositionsDisplay(skillPos);
  const age = resolvePlayerAgeYears(raw.age, raw.years_exp);
  const team = (raw.team ?? "").trim() || "FA";

  return scorePlayer(
    {
      sleeperPlayerId: pid,
      teamAbbr: team,
      positionLabel: position,
      searchRank: sr,
      trendingAdds: ta,
      age,
      yearsExp: typeof raw.years_exp === "number" && Number.isFinite(raw.years_exp) ? raw.years_exp : null,
      nflDraftRound:
        typeof nflDraftRoundBySleeperId[pid] === "number" && Number.isFinite(nflDraftRoundBySleeperId[pid])
          ? nflDraftRoundBySleeperId[pid]!
          : null,
    },
    providers,
    league,
    fp,
  ).value;
}

export function sleeperPlayersMapToCatalogModeled(
  map: SleeperNflPlayersMap,
  trendingAdds: Map<string, number>,
  providers: TradeModelProviders,
  league: LeagueContext,
  fp: FpScoringContext,
  nflDraftRoundBySleeperId: Record<string, number>,
): ModeledPlayerCatalogBuild {
  const staged: Array<{
    base: Omit<CatalogAsset, "value" | "evaluation">;
    rawValue: number;
    confidence01: number;
    components: EvaluationComponent[];
  }> = [];

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
        nflDraftRound:
          typeof nflDraftRoundBySleeperId[pidStr] === "number" && Number.isFinite(nflDraftRoundBySleeperId[pidStr])
            ? nflDraftRoundBySleeperId[pidStr]!
            : null,
      },
      providers,
      league,
      fp,
    );

    staged.push({
      base: {
        id: `sleeper_${pidStr}`,
        kind: "player",
        name: sleeperDisplayName(raw),
        position,
        team,
        sleeperPlayerId: pidStr,
        imageUrl: `https://sleepercdn.com/content/nfl/players/${pidStr}.jpg`,
        sleeperSearchRank: sr,
        sleeperTrendingAdds: ta,
        age,
      },
      rawValue: scored.value,
      confidence01: scored.confidence01,
      components: scored.components,
    });
  }

  const displayAnchor = tradeCalculatorDisplayAnchorFromRaws(staged.map((s) => s.rawValue));
  const scaled = mapCatalogPlayerValuesToDisplayScale(staged);
  scaled.sort((a, b) => a.name.localeCompare(b.name));
  return { assets: scaled, displayAnchor };
}
