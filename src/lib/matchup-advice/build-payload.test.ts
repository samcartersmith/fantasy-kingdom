import { describe, expect, it } from "vitest";
import { pairMatchups } from "@/lib/league-history-aggregate";
import type { SleeperMatchup } from "@/lib/sleeper-league-types";

function findOpponentRosterId(yourRosterId: number, matchups: SleeperMatchup[]): number | null {
  const pairs = pairMatchups(matchups);
  for (const { a, b } of pairs) {
    if (a.roster_id === yourRosterId) return b.roster_id;
    if (b.roster_id === yourRosterId) return a.roster_id;
  }
  return null;
}

describe("matchup opponent pairing", () => {
  it("pairs head-to-head rosters by matchup_id", () => {
    const rows: SleeperMatchup[] = [
      { roster_id: 1, matchup_id: 10, points: 0, starters: [] },
      { roster_id: 2, matchup_id: 10, points: 0, starters: [] },
      { roster_id: 3, matchup_id: 11, points: 0, starters: [] },
      { roster_id: 4, matchup_id: 11, points: 0, starters: [] },
    ];
    expect(findOpponentRosterId(1, rows)).toBe(2);
    expect(findOpponentRosterId(4, rows)).toBe(3);
  });
});
