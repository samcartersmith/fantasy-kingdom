import { describe, expect, it } from "vitest";
import fixtures from "@/lib/season-predictions/league-projection-points.fixtures.json";
import {
  fantasyPointsFromProjectionRow,
  fantasyPointsFromProjectionStats,
  hasLeagueScoringSettings,
  scoringSettingsCacheKey,
} from "@/lib/season-predictions/league-projection-points";

const SHANGHAI_SCORING = fixtures.scoringSettings as Record<string, number>;
const ALLEN_WK2_STATS = fixtures.allenWeek2Stats as Record<string, number>;
const LAWRENCE_WK2_STATS = fixtures.lawrenceWeek2Stats as Record<string, number>;

describe("fantasyPointsFromProjectionStats", () => {
  it("scores Josh Allen week 2 like the Sleeper app (21.14)", () => {
    const pts = fantasyPointsFromProjectionStats(ALLEN_WK2_STATS, SHANGHAI_SCORING);
    expect(pts).toBeCloseTo(21.14, 2);
    expect(pts).toBeLessThan(ALLEN_WK2_STATS.pts_half_ppr!);
  });

  it("scores Trevor Lawrence like the Sleeper app (16.59)", () => {
    const pts = fantasyPointsFromProjectionStats(LAWRENCE_WK2_STATS, SHANGHAI_SCORING);
    expect(pts).toBeCloseTo(16.59, 2);
    expect(pts).toBeLessThan(LAWRENCE_WK2_STATS.pts_half_ppr!);
  });
});

describe("fantasyPointsFromProjectionRow", () => {
  it("uses league scoring when settings are present", () => {
    const row = { player_id: "4984", stats: ALLEN_WK2_STATS };
    expect(fantasyPointsFromProjectionRow(row, SHANGHAI_SCORING, 0.5)).toBeCloseTo(21.14, 2);
  });

  it("falls back to generic half-PPR when league scoring is empty", () => {
    const row = { player_id: "4984", stats: ALLEN_WK2_STATS };
    expect(fantasyPointsFromProjectionRow(row, {}, 0.5)).toBe(23.79);
  });

  it("falls back when league dot-product is zero but generic pts exist", () => {
    const row = {
      player_id: "x",
      stats: { pts_half_ppr: 12.5, pts_ppr: 13, pts_std: 11 },
    };
    expect(fantasyPointsFromProjectionRow(row, { exotic_bonus: 5 }, 0.5)).toBe(12.5);
  });
});

describe("scoringSettingsCacheKey", () => {
  it("uses ppr key when no league scoring", () => {
    expect(scoringSettingsCacheKey({}, 0.5)).toBe("ppr:0.5");
    expect(hasLeagueScoringSettings({})).toBe(false);
  });

  it("uses stable league key when scoring present", () => {
    const a = scoringSettingsCacheKey(SHANGHAI_SCORING, 0.5);
    const b = scoringSettingsCacheKey({ ...SHANGHAI_SCORING }, 0.5);
    expect(a).toBe(b);
    expect(a.startsWith("league:")).toBe(true);
  });
});
