import type { SkillPosition } from "@/lib/sleeper-ranking";
import type { PlayerFantasyProfile } from "@/lib/trade-model/fp-baseline";
import { weightedSeasonTotals } from "@/lib/trade-model/fp-baseline";
import type { LeagueContext, PprMode } from "@/lib/trade-model/types";

/** Split league-wide flex starters evenly across RB / WR / TE pools (simple v1 per plan). */
function flexStartersPerSkill(leagueSize: number, startFlex: number): { rb: number; wr: number; te: number } {
  const pool = leagueSize * startFlex;
  if (pool <= 0) return { rb: 0, wr: 0, te: 0 };
  const base = Math.floor(pool / 3);
  const rem = pool - base * 3;
  return {
    rb: base + (rem >= 1 ? 1 : 0),
    wr: base + (rem >= 2 ? 1 : 0),
    te: base,
  };
}

function listByPosition(
  profiles: Record<string, PlayerFantasyProfile>,
  pos: SkillPosition,
  ppr: PprMode,
): { id: string; proj: number }[] {
  return Object.entries(profiles)
    .filter(([, p]) => p.primaryPosition === pos)
    .map(([id, p]) => ({ id, proj: weightedSeasonTotals(p, ppr).weightedPts }))
    .sort((a, b) => b.proj - a.proj);
}

function baselinePoints(sorted: { id: string; proj: number }[], startersLeagueWide: number): number {
  if (sorted.length === 0 || startersLeagueWide <= 0) return 0;
  const idx = Math.min(Math.max(0, startersLeagueWide - 1), sorted.length - 1);
  return sorted[idx]!.proj;
}

export type VbdComputation = {
  /** Retrospective VBD proxy: weighted fantasy points minus positional “worst starter” baseline. */
  bySleeperId: Record<string, number>;
  /** Scale VBD to ~0–1 for a capped trade-point nudge (p10 / p90 of finite values). */
  scale: { lo: number; hi: number } | null;
};

/**
 * League-aware VBD using **weighted retrospective fantasy points** as the projection proxy
 * (same spine as `weightedSeasonTotals`). Flex demand is split evenly across RB/WR/TE starter pools.
 */
export function computeVbdComputation(
  profiles: Record<string, PlayerFantasyProfile>,
  ppr: PprMode,
  league: LeagueContext,
): VbdComputation {
  const T = league.leagueSize;
  const flex = flexStartersPerSkill(T, league.startFlex);
  const startersQb = T * league.startQb;
  const startersRb = T * league.startRb + flex.rb;
  const startersWr = T * league.startWr + flex.wr;
  const startersTe = T * league.startTe + flex.te;

  const qbL = listByPosition(profiles, "QB", ppr);
  const rbL = listByPosition(profiles, "RB", ppr);
  const wrL = listByPosition(profiles, "WR", ppr);
  const teL = listByPosition(profiles, "TE", ppr);

  const bQb = baselinePoints(qbL, startersQb);
  const bRb = baselinePoints(rbL, startersRb);
  const bWr = baselinePoints(wrL, startersWr);
  const bTe = baselinePoints(teL, startersTe);

  const bySleeperId: Record<string, number> = {};
  for (const row of qbL) bySleeperId[row.id] = row.proj - bQb;
  for (const row of rbL) bySleeperId[row.id] = row.proj - bRb;
  for (const row of wrL) bySleeperId[row.id] = row.proj - bWr;
  for (const row of teL) bySleeperId[row.id] = row.proj - bTe;

  const vals = Object.values(bySleeperId).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  let scale: { lo: number; hi: number } | null = null;
  if (vals.length >= 12) {
    const lo = vals[Math.max(0, Math.floor(0.1 * (vals.length - 1)))];
    const hi = vals[Math.min(vals.length - 1, Math.ceil(0.9 * (vals.length - 1)))];
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) scale = { lo, hi };
  }

  return { bySleeperId, scale };
}
