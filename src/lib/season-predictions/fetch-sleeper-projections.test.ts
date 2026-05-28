import { describe, expect, it } from "vitest";
import { fetchSleeperWeeklyProjections } from "@/lib/season-predictions/fetch-sleeper-projections";

describe("fetchSleeperWeeklyProjections", () => {
  it("parses pts from nested stats on projection rows", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            player_id: "4984",
            stats: { pts_half_ppr: 23.79, pts_ppr: 24.1, pts_std: 20.1 },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const map = await fetchSleeperWeeklyProjections("2026", 1, 0.5);
      expect(map.get("4984")).toBeCloseTo(23.79, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
