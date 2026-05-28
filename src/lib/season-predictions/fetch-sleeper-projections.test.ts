import { describe, expect, it } from "vitest";
import {
  clearProjectionWeekCacheForTests,
  fetchProjectionWeeksParallel,
  fetchSleeperWeeklyProjections,
  fetchSleeperWeeklyProjectionsWithHints,
} from "@/lib/season-predictions/fetch-sleeper-projections";
import fixtures from "@/lib/season-predictions/league-projection-points.fixtures.json";
import { skillPositionsFromProjectionRow } from "@/lib/season-predictions/player-positions";

describe("skillPositionsFromProjectionRow", () => {
  it("reads fantasy_positions and position from projection rows", () => {
    expect(
      skillPositionsFromProjectionRow({
        player_id: "1",
        position: "RB",
        fantasy_positions: ["RB", "WR"],
      }),
    ).toEqual(["RB", "WR"]);
  });
});

describe("fetchSleeperWeeklyProjections", () => {
  it("parses pts from nested stats on projection rows", async () => {
    const originalFetch = globalThis.fetch;
    let fetchInit: RequestInit | undefined;
    globalThis.fetch = async (_input, init) => {
      fetchInit = init;
      return new Response(
        JSON.stringify([
          {
            player_id: "4984",
            position: "QB",
            stats: { pts_half_ppr: 23.79, pts_ppr: 24.1, pts_std: 20.1 },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      clearProjectionWeekCacheForTests();
      const map = await fetchSleeperWeeklyProjections("2026", 1, 0.5);
      expect(map.get("4984")).toBeCloseTo(23.79, 2);
      expect(fetchInit?.cache).toBe("no-store");
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });

  it("filters to relevant player ids when provided", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          { player_id: "a", stats: { pts_ppr: 10 } },
          { player_id: "b", stats: { pts_ppr: 20 } },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      clearProjectionWeekCacheForTests();
      const result = await fetchSleeperWeeklyProjectionsWithHints("2026", 3, 1, new Set(["a"]));
      expect(result.projections.get("a")).toBe(10);
      expect(result.projections.has("b")).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });
});

describe("fetchSleeperWeeklyProjectionsWithHints", () => {
  it("tags team defense ids and infers RB from stats when position is missing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            player_id: "SF",
            stats: { pts_half_ppr: 5.94 },
          },
          {
            player_id: "8151",
            stats: { pts_half_ppr: 13.89, rush_att: 13.51, rec_tgt: 4.18 },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      clearProjectionWeekCacheForTests();
      const result = await fetchSleeperWeeklyProjectionsWithHints("2026", 7, 0.5);
      expect(result.projections.get("SF")).toBeCloseTo(5.94, 2);
      expect(result.rawPositionHints.get("SF")).toBe("DEF");
      expect(result.positionHints.get("8151")).toEqual(["RB"]);
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });

  it("returns position hints alongside projections", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            player_id: "99",
            position: "TE",
            fantasy_positions: ["TE"],
            stats: { pts_ppr: 8.2 },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      clearProjectionWeekCacheForTests();
      const result = await fetchSleeperWeeklyProjectionsWithHints("2026", 2, { ppr: 1 });
      expect(result.projections.get("99")).toBeCloseTo(8.2, 1);
      expect(result.positionHints.get("99")).toEqual(["TE"]);
      expect(result.rawPositionHints.get("99")).toBe("TE");
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });

  it("uses league scoring_settings over generic pts_half_ppr", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            player_id: "4984",
            stats: fixtures.allenWeek2Stats,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      clearProjectionWeekCacheForTests();
      const result = await fetchSleeperWeeklyProjectionsWithHints("2026", 2, {
        ppr: 0.5,
        scoringSettings: fixtures.scoringSettings as Record<string, number>,
      });
      expect(result.projections.get("4984")).toBeCloseTo(21.14, 2);
      expect(result.projections.get("4984")).toBeLessThan(
        (fixtures.allenWeek2Stats as { pts_half_ppr: number }).pts_half_ppr,
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });
});

describe("fetchProjectionWeeksParallel", () => {
  it("fetches multiple weeks with bounded concurrency", async () => {
    const originalFetch = globalThis.fetch;
    const calls: number[] = [];

    globalThis.fetch = async (input) => {
      const url = String(input);
      const match = url.match(/\/(\d+)\?/);
      const week = match ? Number(match[1]) : 0;
      calls.push(week);
      return new Response(
        JSON.stringify([
          {
            player_id: String(week),
            position: "RB",
            stats: { pts_ppr: week },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      clearProjectionWeekCacheForTests();
      const result = await fetchProjectionWeeksParallel([1, 2, 3], "2026", 1, 2);
      expect(result.byWeek.get(1)?.get("1")).toBe(1);
      expect(result.byWeek.get(2)?.get("2")).toBe(2);
      expect(result.byWeek.get(3)?.get("3")).toBe(3);
      expect(calls.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    } finally {
      globalThis.fetch = originalFetch;
      clearProjectionWeekCacheForTests();
    }
  });
});
