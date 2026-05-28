import { describe, expect, it } from "vitest";
import {
  isMatchupAdviceWeekAllowed,
  matchupAdviceAvailableWeeks,
  matchupAdviceDefaultWeek,
  matchupAdviceProjectionPrefetchWeeks,
  matchupAdviceWeekScopeNote,
  matchupAdviceWeekSelectOptions,
} from "@/lib/matchup-advice/projection-prefetch-weeks";
import type { SleeperNflState } from "@/lib/season-predictions/nfl-state";

const offseason: SleeperNflState = {
  season: "2026",
  week: 0,
  season_type: "pre",
};

const inSeason: SleeperNflState = {
  season: "2026",
  week: 8,
  season_type: "regular",
};

describe("matchupAdviceAvailableWeeks", () => {
  it("returns weeks 1–3 during offseason", () => {
    expect(matchupAdviceAvailableWeeks(offseason, 14)).toEqual([1, 2, 3]);
  });

  it("returns current NFL week and next week in season", () => {
    expect(matchupAdviceAvailableWeeks(inSeason, 14)).toEqual([8, 9]);
  });

  it("returns only current week at end of regular season", () => {
    expect(matchupAdviceAvailableWeeks({ ...inSeason, week: 14 }, 14)).toEqual([14]);
  });
});

describe("matchupAdviceDefaultWeek", () => {
  it("defaults to week 1 in offseason", () => {
    expect(matchupAdviceDefaultWeek(offseason, 14)).toBe(1);
  });

  it("defaults to current NFL week in season", () => {
    expect(matchupAdviceDefaultWeek(inSeason, 14)).toBe(8);
  });
});

describe("isMatchupAdviceWeekAllowed", () => {
  it("rejects weeks outside the available window", () => {
    expect(isMatchupAdviceWeekAllowed(inSeason, 8, 14)).toBe(true);
    expect(isMatchupAdviceWeekAllowed(inSeason, 7, 14)).toBe(false);
    expect(isMatchupAdviceWeekAllowed(offseason, 4, 14)).toBe(false);
  });
});

describe("matchupAdviceWeekSelectOptions", () => {
  it("labels current and preseason weeks", () => {
    expect(matchupAdviceWeekSelectOptions(inSeason, 14)).toEqual([
      { value: "8", label: "Week 8 (current)" },
      { value: "9", label: "Week 9" },
    ]);
    expect(matchupAdviceWeekSelectOptions(offseason, 14)[0]).toEqual({
      value: "1",
      label: "Week 1 (preseason)",
    });
  });
});

describe("matchupAdviceWeekScopeNote", () => {
  it("describes offseason and in-season windows", () => {
    expect(matchupAdviceWeekScopeNote(offseason)).toContain("Offseason");
    expect(matchupAdviceWeekScopeNote(inSeason)).toContain("current NFL week");
  });
});

describe("matchupAdviceProjectionPrefetchWeeks", () => {
  it("returns weeks 1–3 during offseason", () => {
    expect(matchupAdviceProjectionPrefetchWeeks(offseason, 1, 14)).toEqual([1, 2, 3]);
    expect(matchupAdviceProjectionPrefetchWeeks(offseason, 5, 14)).toEqual([1, 2, 3]);
  });

  it("clamps offseason weeks to regularSeasonWeeks", () => {
    expect(matchupAdviceProjectionPrefetchWeeks(offseason, 1, 2)).toEqual([1, 2]);
  });

  it("returns only viewed week + 1 in season", () => {
    expect(matchupAdviceProjectionPrefetchWeeks(inSeason, 5, 14)).toEqual([6]);
    expect(matchupAdviceProjectionPrefetchWeeks(inSeason, 1, 14)).toEqual([2]);
  });

  it("returns empty when next week is past regular season", () => {
    expect(matchupAdviceProjectionPrefetchWeeks(inSeason, 14, 14)).toEqual([]);
  });

  it("treats null nfl state as in season", () => {
    expect(matchupAdviceProjectionPrefetchWeeks(null, 5, 14)).toEqual([6]);
  });
});
