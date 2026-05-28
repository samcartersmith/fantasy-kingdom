import { describe, expect, it } from "vitest";
import { pairMatchups } from "@/lib/league-history-aggregate";
import {
  applyHeadToHeadResult,
  emptyWeekOutcome,
  formatProjectedRecord,
  hasRecordedMatchupScore,
  rosterWeekScore,
  rosterWeekUsesActuals,
} from "@/lib/season-predictions/scoring";
import {
  sumRosterProjectionPoints,
  starterPlayerIds,
} from "@/lib/season-predictions/fetch-sleeper-projections";
import type { SleeperMatchup } from "@/lib/sleeper-league-types";

describe("hasRecordedMatchupScore", () => {
  it("detects points and custom_points", () => {
    expect(hasRecordedMatchupScore({ roster_id: 1, matchup_id: 1, points: 100 })).toBe(true);
    expect(
      hasRecordedMatchupScore({
        roster_id: 1,
        matchup_id: 1,
        points: 0,
        custom_points: 88,
      }),
    ).toBe(true);
    expect(hasRecordedMatchupScore({ roster_id: 1, matchup_id: 1, points: 0 })).toBe(false);
  });
});

describe("rosterWeekUsesActuals", () => {
  const row: SleeperMatchup = { roster_id: 1, matchup_id: 1, points: 110 };

  it("uses actuals for past weeks when NFL week has advanced", () => {
    expect(rosterWeekUsesActuals(5, 8, undefined)).toBe(true);
    expect(rosterWeekUsesActuals(5, 8, row)).toBe(true);
  });

  it("does not treat offseason week 0 as past", () => {
    expect(rosterWeekUsesActuals(5, 0, { roster_id: 1, matchup_id: 1, points: 0 })).toBe(
      false,
    );
  });

  it("uses actuals for current week when score recorded", () => {
    expect(rosterWeekUsesActuals(8, 8, row)).toBe(true);
  });

  it("uses projections for future week without score", () => {
    expect(
      rosterWeekUsesActuals(9, 8, { roster_id: 1, matchup_id: 1, points: 0 }),
    ).toBe(false);
  });
});

describe("rosterWeekScore", () => {
  it("returns actual matchup points for completed weeks", () => {
    const row: SleeperMatchup = { roster_id: 1, matchup_id: 1, points: 125.4 };
    const result = rosterWeekScore(3, 8, row, ["p1"], ["p1", "p2"], new Map([["p2", 20]]));
    expect(result.usedActuals).toBe(true);
    expect(result.score).toBe(125.4);
  });

  it("sums starter projections when week is in the future", () => {
    const projections = new Map([
      ["p1", 12.5],
      ["p2", 8],
      ["p3", 15],
    ]);
    const result = rosterWeekScore(
      10,
      8,
      { roster_id: 1, matchup_id: 1, points: 0, starters: ["p1", "p2"] },
      null,
      ["p1", "p2", "p3"],
      projections,
    );
    expect(result.usedActuals).toBe(false);
    expect(result.score).toBe(20.5);
  });
});

describe("sumRosterProjectionPoints", () => {
  it("ignores missing players", () => {
    const map = new Map([["a", 10]]);
    expect(sumRosterProjectionPoints(["a", "b"], map)).toBe(10);
  });

});

describe("starterPlayerIds", () => {
  it("prefers matchup starters over roster", () => {
    expect(
      starterPlayerIds({ starters: ["a", "b"] }, ["x"], ["a", "b", "c"]),
    ).toEqual(["a", "b"]);
  });
});

describe("applyHeadToHeadResult", () => {
  it("accumulates wins losses ties and points", () => {
    const acc = emptyWeekOutcome();
    expect(applyHeadToHeadResult(1, 2, 100, 90, acc)).toBe(1);
    expect(acc.wins.get(1)).toBe(1);
    expect(acc.losses.get(2)).toBe(1);
    expect(acc.pointsFor.get(1)).toBe(100);
    expect(acc.pointsAgainst.get(1)).toBe(90);

    expect(applyHeadToHeadResult(1, 3, 80, 80, acc)).toBeNull();
    expect(acc.ties.get(1)).toBe(1);
    expect(acc.ties.get(3)).toBe(1);
  });
});

describe("pairMatchups integration", () => {
  it("resolves winners from paired scores", () => {
    const rows: SleeperMatchup[] = [
      { roster_id: 1, matchup_id: 5, points: 100 },
      { roster_id: 2, matchup_id: 5, points: 95 },
    ];
    const pairs = pairMatchups(rows);
    const acc = emptyWeekOutcome();
    const { a, b } = pairs[0]!;
    const sa = rosterWeekScore(1, 2, a, null, [], new Map());
    const sb = rosterWeekScore(1, 2, b, null, [], new Map());
    const winner = applyHeadToHeadResult(a.roster_id, b.roster_id, sa.score, sb.score, acc);
    expect(winner).toBe(1);
    expect(formatProjectedRecord(acc.wins.get(1) ?? 0, acc.losses.get(1) ?? 0, 0)).toBe("1-0");
  });
});

describe("formatProjectedRecord", () => {
  it("includes ties when present", () => {
    expect(formatProjectedRecord(10, 3, 1)).toBe("10-3-1");
    expect(formatProjectedRecord(10, 3, 0)).toBe("10-3");
  });
});
