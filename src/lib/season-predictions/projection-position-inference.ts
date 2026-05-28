import type { SkillPosition } from "@/lib/sleeper-ranking";

/** Sleeper roster DEF slots often use NFL team abbreviations as player_id. */
export const SLEEPER_TEAM_DEFENSE_IDS = new Set([
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
]);

export function isSleeperTeamDefenseId(playerId: string | null | undefined): boolean {
  if (!playerId) return false;
  return SLEEPER_TEAM_DEFENSE_IDS.has(playerId.trim().toUpperCase());
}

function statNumber(stats: Record<string, unknown> | null, key: string): number {
  if (!stats) return 0;
  const raw = stats[key];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * When Sleeper omits position on a projection row, infer skill tags from projected usage.
 */
export function skillPositionsFromProjectionStats(
  row: Record<string, unknown>,
): SkillPosition[] {
  const stats =
    row.stats && typeof row.stats === "object"
      ? (row.stats as Record<string, unknown>)
      : null;
  if (!stats) return [];

  const passAtt = statNumber(stats, "pass_att") || statNumber(stats, "attempts");
  const rushAtt = statNumber(stats, "rush_att");
  const recTgt = statNumber(stats, "rec_tgt");

  const found = new Set<SkillPosition>();

  if (passAtt >= 1) found.add("QB");
  if (rushAtt >= 1) found.add("RB");
  if (recTgt >= 1) {
    found.add("WR");
    found.add("TE");
  }

  // Primary rusher: RB only (avoids mis-tagging workhorse backs as WR-only).
  if (rushAtt >= 3 && rushAtt > recTgt) {
    found.delete("WR");
    found.delete("TE");
    if (!found.has("QB")) found.add("RB");
  }

  // Pass-catcher without meaningful rush: WR (TE eligibility still from explicit hints).
  if (recTgt >= 2 && rushAtt < 1) {
    found.delete("TE");
    if (!found.has("QB")) found.add("WR");
  }

  return Array.from(found);
}

export function rawPositionHintForPlayerId(
  playerId: string,
  rowRaw: string | null,
): string | null {
  if (rowRaw) return rowRaw;
  if (isSleeperTeamDefenseId(playerId)) return "DEF";
  return null;
}
