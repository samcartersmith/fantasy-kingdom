import type { PprMode } from "@/lib/trade-model/types";

const PROJECTION_REVALIDATE_SECONDS = 3600;

type ProjectionRow = Record<string, unknown>;

function projectionPts(row: ProjectionRow, ppr: PprMode): number {
  const key = ppr === 1 ? "pts_ppr" : ppr === 0.5 ? "pts_half_ppr" : "pts_std";
  const stats = row.stats;
  const statsObj =
    stats && typeof stats === "object" ? (stats as Record<string, unknown>) : null;
  const raw = statsObj?.[key] ?? row[key];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function playerIdFromRow(row: ProjectionRow): string | null {
  const id = row.player_id ?? row.playerId;
  if (id == null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

/** Undocumented Sleeper endpoint — weekly NFL player projections. */
export function sleeperWeeklyProjectionsUrl(season: string, week: number): string {
  const q = new URLSearchParams({ season_type: "regular" });
  return `https://api.sleeper.com/projections/nfl/${encodeURIComponent(season)}/${week}?${q.toString()}`;
}

export async function fetchSleeperWeeklyProjections(
  season: string,
  week: number,
  ppr: PprMode,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const res = await fetch(sleeperWeeklyProjectionsUrl(season, week), {
      next: { revalidate: PROJECTION_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return out;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as ProjectionRow;
      const playerId = playerIdFromRow(r);
      if (!playerId) continue;
      const pts = projectionPts(r, ppr);
      if (pts > 0) out.set(playerId, pts);
    }
  } catch {
    return out;
  }
  return out;
}

export function sumRosterProjectionPoints(
  playerIds: string[] | null | undefined,
  projections: Map<string, number>,
): number {
  if (!playerIds?.length) return 0;
  let total = 0;
  for (const id of playerIds) {
    if (!id) continue;
    const pts = projections.get(id);
    if (pts != null && pts > 0) total += pts;
  }
  return total;
}

/** Sleeper lineup slots for a week (matchup starters, then roster starters). */
export function starterPlayerIds(
  matchupRow: { starters?: string[] } | undefined,
  rosterStarters: string[] | null | undefined,
  rosterPlayers: string[] | null | undefined,
): string[] {
  const fromMatchup = matchupRow?.starters?.filter(Boolean);
  if (fromMatchup?.length) return fromMatchup;
  const fromRoster = rosterStarters?.filter(Boolean);
  if (fromRoster?.length) return fromRoster;
  return rosterPlayers?.filter(Boolean) ?? [];
}
