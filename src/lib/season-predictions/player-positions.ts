import fantasyProfileJson from "@/data/trade-model/player-fantasy-profile.json";
import type { PlayerFantasyProfile } from "@/lib/trade-model/fp-baseline";
import { isSleeperTeamDefenseId } from "@/lib/season-predictions/projection-position-inference";
import type { SkillPosition } from "@/lib/sleeper-ranking";

const fantasyProfiles = (fantasyProfileJson as { profiles: Record<string, PlayerFantasyProfile> })
  .profiles;

export type RosterPositionIndex = {
  skillByPlayerId: Map<string, SkillPosition[]>;
  rawPositionByPlayerId: Map<string, string | null>;
};

function skillFromProfile(playerId: string): SkillPosition[] {
  const profile = fantasyProfiles[playerId];
  if (!profile?.primaryPosition) return [];
  return [profile.primaryPosition];
}

function rawFromProfile(playerId: string): string | null {
  const profile = fantasyProfiles[playerId];
  const pos = profile?.primaryPosition;
  if (pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE") return pos;
  return null;
}

/** Skill positions from a Sleeper projection row when present. */
export function skillPositionsFromProjectionRow(
  row: Record<string, unknown>,
): SkillPosition[] {
  const found = new Set<SkillPosition>();
  const fantasy = row.fantasy_positions;
  if (Array.isArray(fantasy)) {
    for (const p of fantasy) {
      const u = String(p ?? "")
        .trim()
        .toUpperCase();
      if (u === "QB" || u === "RB" || u === "WR" || u === "TE") found.add(u);
    }
  }
  const pos = String(row.position ?? "")
    .trim()
    .toUpperCase();
  if (pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE") found.add(pos);
  return Array.from(found);
}

export function rawPositionFromProjectionRow(row: Record<string, unknown>): string | null {
  const pos = String(row.position ?? "")
    .trim()
    .toUpperCase();
  return pos.length > 0 ? pos : null;
}

/** Merge projection hints into an index (later hints do not overwrite non-empty skill). */
export function mergeProjectionPositionHints(
  index: RosterPositionIndex,
  hints: Map<string, SkillPosition[]>,
  rawHints?: Map<string, string | null>,
): void {
  for (const [id, positions] of hints) {
    if (positions.length > 0) {
      const existing = index.skillByPlayerId.get(id) ?? [];
      const merged = new Set<SkillPosition>([...existing, ...positions]);
      index.skillByPlayerId.set(id, Array.from(merged));
    }
    if (rawHints?.has(id)) {
      const raw = rawHints.get(id);
      if (raw) index.rawPositionByPlayerId.set(id, raw);
    }
  }
}

/** Fast path: bundled fantasy profile + optional projection hints (no players/nfl). */
export function buildRosterPositionIndexFromProfile(
  playerIds: Iterable<string>,
  projectionHints?: Map<string, SkillPosition[]>,
  rawHints?: Map<string, string | null>,
): RosterPositionIndex {
  const skillByPlayerId = new Map<string, SkillPosition[]>();
  const rawPositionByPlayerId = new Map<string, string | null>();

  for (const id of playerIds) {
    if (!id) continue;
    const fromProfile = skillFromProfile(id);
    if (fromProfile.length > 0) {
      skillByPlayerId.set(id, fromProfile);
      const raw = rawFromProfile(id);
      if (raw) rawPositionByPlayerId.set(id, raw);
    }
    if (isSleeperTeamDefenseId(id)) {
      rawPositionByPlayerId.set(id, "DEF");
    }
  }

  const index: RosterPositionIndex = { skillByPlayerId, rawPositionByPlayerId };
  if (projectionHints) mergeProjectionPositionHints(index, projectionHints, rawHints);

  for (const id of playerIds) {
    if (id && isSleeperTeamDefenseId(id)) {
      index.rawPositionByPlayerId.set(id, "DEF");
    }
  }

  return index;
}

export function toLineupPositionLookup(index: RosterPositionIndex): Map<string, SkillPosition[]> {
  return index.skillByPlayerId;
}
