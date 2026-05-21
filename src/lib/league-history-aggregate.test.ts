import { describe, expect, it } from "vitest";
import {
  accumulateMatchupWeek,
  buildChartsFromAccumulators,
  mergeChampionship,
  pairMatchups,
  resolveChampionFromBracket,
  type NuclearWeekRow,
} from "@/lib/league-history-aggregate";
import type { SleeperBracketMatch, SleeperMatchup } from "@/lib/sleeper-league-types";

describe("resolveChampionFromBracket", () => {
  it("returns winner of highest round with p=1 when present", () => {
    const bracket: SleeperBracketMatch[] = [
      { r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 },
      { r: 2, m: 2, t1: 1, t2: 3, w: 1, l: 3, p: 1 },
    ];
    expect(resolveChampionFromBracket(bracket)).toBe(1);
  });

  it("returns null when no winners recorded", () => {
    expect(resolveChampionFromBracket([{ r: 1, m: 1, t1: 1, t2: 2 }])).toBeNull();
  });
});

describe("pairMatchups and accumulateMatchupWeek", () => {
  it("counts wins and points for a head-to-head week", () => {
    const rows: SleeperMatchup[] = [
      { roster_id: 1, matchup_id: 10, points: 120 },
      { roster_id: 2, matchup_id: 10, points: 95 },
    ];
    const pairs = pairMatchups(rows);
    expect(pairs).toHaveLength(1);

    const wins = new Map<number, number>();
    const losses = new Map<number, number>();
    const ties = new Map<number, number>();
    const points = new Map<number, number>();
    const nuclear: NuclearWeekRow[] = [];
    const names = new Map<number, string>([
      [1, "Alpha"],
      [2, "Beta"],
    ]);

    accumulateMatchupWeek(pairs, wins, losses, ties, points, nuclear, "2024", 3, names);

    expect(wins.get(1)).toBe(1);
    expect(losses.get(2)).toBe(1);
    expect(points.get(1)).toBe(120);
    expect(points.get(2)).toBe(95);
    expect(nuclear[0]?.points).toBe(120);
  });
});

describe("buildChartsFromAccumulators", () => {
  it("merges multi-season championships", () => {
    const names = new Map<number, string>([[5, "Champ"]]);
    const championships = new Map<number, { count: number; seasons: string[] }>();
    mergeChampionship(championships, 5, "2022");
    mergeChampionship(championships, 5, "2024");

    const charts = buildChartsFromAccumulators(
      names,
      championships,
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      [],
      new Map(),
      new Map(),
    );

    expect(charts.championships).toHaveLength(1);
    expect(charts.championships[0]?.count).toBe(2);
    expect(charts.championships[0]?.seasons).toEqual(["2024", "2022"]);
  });
});
