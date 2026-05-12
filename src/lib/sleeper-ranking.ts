import type { SleeperNflPlayer, SleeperNflPlayersMap } from "@/lib/sleeper-types";

/** Row for `/rankings` and related APIs — all signals are from Sleeper read-only endpoints. */
export type SleeperRankingRow = {
  rank: number;
  sleeperPlayerId: string;
  name: string;
  team: string;
  position: string;
  search_rank: number | null;
  trending_adds: number;
  /** Heuristic trade points derived from search_rank + trending adds (not an official Sleeper $ value). */
  value: number;
};

const MISSING_SEARCH_RANK = 999_999;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizedSearchRank(raw: SleeperNflPlayer): number | null {
  const v = raw.search_rank;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return null;
}

/**
 * Heuristic “trade value” from Sleeper-only signals:
 * - Lower `search_rank` → higher value (more searched in Sleeper).
 * - Recent add counts (trending) nudge value up slightly.
 * Not a market or ADP dollar; document clearly in UI.
 */
export function tradeValueFromSleeperSignals(
  searchRank: number | null,
  trendingAdds: number,
): number {
  const rankForCurve = searchRank ?? 720;
  let v = 14_200 - Math.min(rankForCurve, 2500) * 5.2 + Math.min(trendingAdds, 120) * 18;
  v = Math.round(clamp(v, 400, 19_000));
  return v;
}

export function compareSleeperRankingRows(a: SleeperRankingRow, b: SleeperRankingRow): number {
  const ar = a.search_rank ?? MISSING_SEARCH_RANK;
  const br = b.search_rank ?? MISSING_SEARCH_RANK;
  if (ar !== br) return ar - br;
  if (b.trending_adds !== a.trending_adds) return b.trending_adds - a.trending_adds;
  return a.name.localeCompare(b.name);
}

export function sleeperDisplayName(p: SleeperNflPlayer): string {
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || "Unknown player";
}

export function fantasyPrimary(p: SleeperNflPlayer): string {
  const base = (p.position ?? "").toUpperCase();
  if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(base)) return base;
  const fp = p.fantasy_positions?.filter(Boolean);
  if (fp?.length) return fp[0]!.toUpperCase();
  return "UNK";
}

function isRankableNflPlayer(raw: SleeperNflPlayer, key: string): string | null {
  const pid = raw.player_id ?? key;
  if (!/^\d+$/.test(String(pid))) return null;
  if (raw.sport && raw.sport !== "nfl") return null;
  if (raw.status !== "Active") return null;
  const team = (raw.team ?? "").trim();
  if (!team) return null;
  return String(pid);
}

const RANKING_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

/**
 * Build sorted ranking rows from the full players map + trending adds.
 * @param positionFilter `ALL` or a single position code (QB, RB, WR, TE, K, DEF).
 */
export function buildSleeperRankingRows(
  map: SleeperNflPlayersMap,
  trendingAdds: Map<string, number>,
  positionFilter: string,
  limit: number,
): SleeperRankingRow[] {
  const want = positionFilter.toUpperCase();
  const rows: SleeperRankingRow[] = [];

  for (const [key, raw] of Object.entries(map)) {
    if (!raw || typeof raw !== "object") continue;
    const pid = isRankableNflPlayer(raw, key);
    if (!pid) continue;

    const pos = fantasyPrimary(raw);
    if (!RANKING_POSITIONS.has(pos)) continue;
    if (want !== "ALL" && pos !== want) continue;

    const sr = normalizedSearchRank(raw);
    const ta = trendingAdds.get(pid) ?? 0;
    const value = tradeValueFromSleeperSignals(sr, ta);

    rows.push({
      rank: 0,
      sleeperPlayerId: pid,
      name: sleeperDisplayName(raw),
      team: (raw.team ?? "").trim(),
      position: pos,
      search_rank: sr,
      trending_adds: ta,
      value,
    });
  }

  rows.sort(compareSleeperRankingRows);
  const sliced = rows.slice(0, Math.max(1, Math.min(limit, 300)));
  sliced.forEach((r, i) => {
    r.rank = i + 1;
  });
  return sliced;
}
