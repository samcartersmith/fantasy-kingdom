import type { SleeperRoster } from "@/lib/sleeper-league-types";

function excludedStashIds(roster: SleeperRoster): Set<string> {
  const skip = new Set<string>();
  for (const id of roster.taxi ?? []) {
    if (id) skip.add(id);
  }
  for (const id of roster.reserve ?? []) {
    if (id) skip.add(id);
  }
  return skip;
}

/**
 * Sleeper roster player ids eligible for weekly lineup scoring (starters + bench).
 * Excludes taxi and IR/reserve slots.
 */
export function activeLineupPlayerIds(roster: SleeperRoster): string[] {
  const skip = excludedStashIds(roster);
  return (roster.players ?? []).filter((id): id is string => Boolean(id) && !skip.has(id));
}

export function collectActiveLineupPlayerIds(rosters: SleeperRoster[]): Set<string> {
  const ids = new Set<string>();
  for (const roster of rosters) {
    for (const id of activeLineupPlayerIds(roster)) {
      ids.add(id);
    }
  }
  return ids;
}
