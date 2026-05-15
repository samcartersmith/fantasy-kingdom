import { describe, expect, it } from "vitest";
import { buildFpAnchors, buildRichStatAnchors, type PlayerFantasyProfile } from "@/lib/trade-model/fp-baseline";
import { computeVbdComputation } from "@/lib/trade-model/vbd";
import { DEFAULT_STARTING_SLOTS } from "@/lib/trade-model/types";
import type { LeagueContext } from "@/lib/trade-model/types";
import {
  buildTradeSpinePrecompute,
  rankCurve01,
  RANK_BASE_MIN,
  RANK_BASE_SPAN,
  RANK_BASE_SPAN_TE,
} from "@/lib/trade-model/trade-spine";

function season(pts: number, games = 17) {
  return { pts_ppr: pts, pts_half_ppr: Math.max(0, pts - 15), pts_std: Math.max(0, pts - 35), games };
}

describe("rankCurve01", () => {
  it("keeps RB1↔RB2 tighter on the curve than RB1↔~RB10", () => {
    const n = 12;
    const top2 = rankCurve01(0, n, "RB") - rankCurve01(1, n, "RB");
    const topVsTenth = rankCurve01(0, n, "RB") - rankCurve01(9, n, "RB");
    expect(top2).toBeGreaterThan(0);
    expect(topVsTenth).toBeGreaterThan(top2 * 3);
  });
});

describe("buildTradeSpinePrecompute", () => {
  it("maps RB rank gaps so top-2 is much smaller than top-1 vs ~RB10 (rank base)", () => {
    const league: LeagueContext = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr: 1, leagueSize: 12 };
    const filler: Record<string, PlayerFantasyProfile> = {};
    for (let i = 0; i < 12; i++) {
      filler[`qb_${i}`] = {
        primaryPosition: "QB",
        seasons: { "2025": season(220 - i * 4), "2024": season(200 - i * 4) },
      };
      filler[`wr_${i}`] = {
        primaryPosition: "WR",
        seasons: { "2025": season(80 + i * 3), "2024": season(70 + i * 3) },
      };
      filler[`te_${i}`] = {
        primaryPosition: "TE",
        seasons: { "2025": season(50 + i * 2), "2024": season(45 + i * 2) },
      };
    }
    const profiles: Record<string, PlayerFantasyProfile> = { ...filler };
    for (let i = 0; i < 12; i++) {
      profiles[`rb_${i}`] = {
        primaryPosition: "RB",
        seasons: { "2025": season(300 - i * 2), "2024": season(270 - i * 2) },
      };
    }
    const anchors = buildFpAnchors(profiles, 1);
    const richAnchors = buildRichStatAnchors(profiles, 1);
    const vbd = computeVbdComputation(profiles, 1, league);
    const spine = buildTradeSpinePrecompute(profiles, 1, vbd.bySleeperId, richAnchors, anchors);
    const rb0 = spine.rankBaseBySleeperId.rb_0!;
    const rb1 = spine.rankBaseBySleeperId.rb_1!;
    const rb9 = spine.rankBaseBySleeperId.rb_9!;
    expect(rb0 - rb1).toBeLessThan(rb0 - rb9);
    expect(rb0 - rb9).toBeGreaterThan((rb0 - rb1) * 3);
  });

  it("assigns a lower rank ceiling to TE than to WR for rank #1", () => {
    const league: LeagueContext = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr: 1, leagueSize: 12 };
    const filler: Record<string, PlayerFantasyProfile> = {};
    for (let i = 0; i < 12; i++) {
      filler[`wr_${i}`] = {
        primaryPosition: "WR",
        seasons: { "2025": season(80 + i * 3), "2024": season(70 + i * 3) },
      };
      filler[`te_${i}`] = {
        primaryPosition: "TE",
        seasons: { "2025": season(50 + i * 2), "2024": season(45 + i * 2) },
      };
    }
    const profiles: Record<string, PlayerFantasyProfile> = {
      ...filler,
      wr1: { primaryPosition: "WR", seasons: { "2025": season(320), "2024": season(280) } },
      te1: { primaryPosition: "TE", seasons: { "2025": season(260), "2024": season(230) } },
    };
    const anchors = buildFpAnchors(profiles, 1);
    const richAnchors = buildRichStatAnchors(profiles, 1);
    const vbd = computeVbdComputation(profiles, 1, league);
    const spine = buildTradeSpinePrecompute(profiles, 1, vbd.bySleeperId, richAnchors, anchors);
    const wrTop = spine.rankBaseBySleeperId.wr1!;
    const teTop = spine.rankBaseBySleeperId.te1!;
    expect(wrTop).toBeGreaterThan(teTop);
    expect(wrTop).toBeLessThanOrEqual(RANK_BASE_MIN + RANK_BASE_SPAN + 50);
    expect(teTop).toBeLessThanOrEqual(RANK_BASE_MIN + RANK_BASE_SPAN_TE + 50);
  });
});
