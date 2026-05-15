import { describe, expect, it } from "vitest";
import {
  buildFpAnchors,
  buildRichStatAnchors,
  productionBaseTradePoints,
  stretchCombinedNorm01,
  weightedSeasonTotals,
  type PlayerFantasyProfile,
} from "@/lib/trade-model/fp-baseline";
import { scorePlayer } from "@/lib/trade-model/score-player";
import { buildTradeSpinePrecompute } from "@/lib/trade-model/trade-spine";
import { scorePick } from "@/lib/trade-model/score-pick";
import type { LeagueContext, TradeModelProviders } from "@/lib/trade-model/types";
import { DEFAULT_STARTING_SLOTS } from "@/lib/trade-model/types";
import { computeVbdComputation } from "@/lib/trade-model/vbd";
import { BUZZ_MAX_POINTS, buzzTweakPoints } from "@/lib/trade-model/weights";

const neutralLeague: LeagueContext = {
  ...DEFAULT_STARTING_SLOTS,
  superflex: false,
  ppr: 1,
  leagueSize: 12,
};

function neutralProviders(teamTier: number, teamMissing: boolean): TradeModelProviders {
  const t = { tier01: teamTier, missing: teamMissing };
  const neutral = { tier01: 0.5, missing: true };
  return {
    teamOffense: { getTeamOffense: () => t },
    coordinator: { getOcQuality: () => neutral },
    history: { getHistoryTier: () => neutral },
    role: { getRoleTier: () => neutral },
    injury: { getAvailabilityTier: () => neutral },
    draftClass: { getClassStrength01: () => neutral },
  };
}

/** Enough WR profiles for positional anchors (min 8). */
function wrSeason(pts: number, games = 17) {
  return { pts_ppr: pts, pts_half_ppr: Math.max(0, pts - 20), pts_std: Math.max(0, pts - 40), games };
}

function seedWrProfiles(): Record<string, PlayerFantasyProfile> {
  const out: Record<string, PlayerFantasyProfile> = {};
  const pts = [40, 55, 70, 85, 100, 115, 130, 150, 170, 190, 210, 240];
  pts.forEach((p, i) => {
    out[`seed_wr_${i}`] = {
      primaryPosition: "WR",
      seasons: {
        "2025": wrSeason(p),
        "2024": wrSeason(Math.max(25, p - 30)),
      },
    };
  });
  return out;
}

function mkFp(extra: Record<string, PlayerFantasyProfile>, ppr: LeagueContext["ppr"] = 1) {
  const profiles = { ...seedWrProfiles(), ...extra };
  const league: LeagueContext = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr, leagueSize: 12 };
  const anchors = buildFpAnchors(profiles, ppr);
  const richAnchors = buildRichStatAnchors(profiles, ppr);
  const vbd = computeVbdComputation(profiles, ppr, league);
  const tradeSpine = buildTradeSpinePrecompute(profiles, ppr, vbd.bySleeperId, richAnchors, anchors);
  return {
    snapshotAsOf: "2099-01-01",
    profiles,
    anchors,
    richAnchors,
    vbdBySleeperId: vbd.bySleeperId,
    vbdScale: vbd.scale,
    tradeSpine,
  };
}

const fixedPlayer = {
  sleeperPlayerId: "999",
  positionLabel: "WR",
  searchRank: 120,
  trendingAdds: 4,
  age: 25,
  yearsExp: 3,
  nflDraftRound: null as number | null,
};

describe("scorePlayer", () => {
  it("raises value when team offense tier increases (all else equal)", () => {
    const fp = mkFp({
      "999": {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(160), "2024": wrSeason(140) },
      },
    });
    const low = scorePlayer({ ...fixedPlayer, teamAbbr: "ZZ1" }, neutralProviders(0.35, false), neutralLeague, fp);
    const high = scorePlayer({ ...fixedPlayer, teamAbbr: "ZZ2" }, neutralProviders(0.92, false), neutralLeague, fp);
    expect(high.value).toBeGreaterThanOrEqual(low.value);
  });

  it("treats missing team data as neutral vs explicit mid tier", () => {
    const fp = mkFp({
      "999": {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(160), "2024": wrSeason(140) },
      },
    });
    const missing = scorePlayer({ ...fixedPlayer, teamAbbr: "XXX" }, neutralProviders(0.5, true), neutralLeague, fp);
    const explicit = scorePlayer({ ...fixedPlayer, teamAbbr: "YYY" }, neutralProviders(0.5, false), neutralLeague, fp);
    expect(missing.value).toBe(explicit.value);
  });

  it("ranks a high-FP WR well above a low-FP WR when buzz is identical", () => {
    const fp = mkFp({
      star: {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(380), "2024": wrSeason(300) },
      },
      scrub: {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(48), "2024": wrSeason(40) },
      },
    });
    const buzz = {
      searchRank: 400,
      trendingAdds: 10,
      age: 24,
      yearsExp: 2,
      nflDraftRound: null as number | null,
    };
    const star = scorePlayer(
      { sleeperPlayerId: "star", teamAbbr: "CIN", positionLabel: "WR", ...buzz },
      neutralProviders(0.5, true),
      neutralLeague,
      fp,
    );
    const scrub = scorePlayer(
      { sleeperPlayerId: "scrub", teamAbbr: "CIN", positionLabel: "WR", ...buzz },
      neutralProviders(0.5, true),
      neutralLeague,
      fp,
    );
    expect(star.value - scrub.value).toBeGreaterThan(1500);
  });

  it("caps Sleeper buzz contribution magnitude", () => {
    const lowBuzz = buzzTweakPoints(2000, 0, BUZZ_MAX_POINTS);
    const highBuzz = buzzTweakPoints(1, 120, BUZZ_MAX_POINTS);
    expect(Math.abs(highBuzz - lowBuzz)).toBeLessThanOrEqual(2 * BUZZ_MAX_POINTS + 5);
  });
});

describe("weightedSeasonTotals recency", () => {
  it("uses 65/35 for two seasons (newest heaviest)", () => {
    const profile: PlayerFantasyProfile = {
      primaryPosition: "WR",
      seasons: { "2025": wrSeason(100), "2024": wrSeason(80) },
    };
    expect(weightedSeasonTotals(profile, 1).weightedPts).toBeCloseTo(0.65 * 100 + 0.35 * 80);
  });

  it("uses 50/35/15 when 2023–2025 are all present", () => {
    const profile: PlayerFantasyProfile = {
      primaryPosition: "WR",
      seasons: { "2025": wrSeason(100), "2024": wrSeason(80), "2023": wrSeason(60) },
    };
    expect(weightedSeasonTotals(profile, 1).weightedPts).toBeCloseTo(0.5 * 100 + 0.35 * 80 + 0.15 * 60);
  });

  it("treats negative nflverse-style season totals as zero for weighting", () => {
    const profile: PlayerFantasyProfile = {
      primaryPosition: "WR",
      seasons: { "2025": { pts_ppr: -3, pts_half_ppr: -2, pts_std: -1, games: 8 } },
    };
    expect(weightedSeasonTotals(profile, 1).weightedPts).toBe(0);
  });
});

describe("stretchCombinedNorm01", () => {
  it("expands separation in the elite band vs identity mapping", () => {
    const a = stretchCombinedNorm01(0.86);
    const b = stretchCombinedNorm01(0.94);
    expect(b - a).toBeGreaterThan(0.94 - 0.86);
  });
});

describe("productionBaseTradePoints elite tail", () => {
  it("does not produce NaN when a season row has negative points (clamped to 0)", () => {
    const profiles: Record<string, PlayerFantasyProfile> = {
      ...seedWrProfiles(),
      neg: {
        primaryPosition: "WR",
        seasons: { "2025": { pts_ppr: -2, pts_half_ppr: -1, pts_std: 0, games: 4 } },
      },
    };
    const anchors = buildFpAnchors(profiles, 1);
    const richAnchors = buildRichStatAnchors(profiles, 1);
    const league: LeagueContext = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr: 1, leagueSize: 12 };
    const vbd = computeVbdComputation(profiles, 1, league);
    const tradeSpine = buildTradeSpinePrecompute(profiles, 1, vbd.bySleeperId, richAnchors, anchors);
    const fp = {
      snapshotAsOf: "2099-01-01",
      profiles,
      anchors,
      richAnchors,
      vbdBySleeperId: vbd.bySleeperId,
      vbdScale: vbd.scale,
      tradeSpine,
    };
    const r = productionBaseTradePoints(profiles.neg, "WR", 1, fp);
    expect(Number.isFinite(r.basePoints)).toBe(true);
    expect(Number.isFinite(r.combinedNorm01)).toBe(true);
  });

  it("assigns meaningfully wider basePoints between two high-end WR profiles than raw norm delta alone", () => {
    const profiles: Record<string, PlayerFantasyProfile> = {
      ...Object.fromEntries(
        [40, 55, 70, 85, 100, 115, 130, 145].map((p, i) => [
          `fill_${i}`,
          { primaryPosition: "WR" as const, seasons: { "2025": wrSeason(p), "2024": wrSeason(Math.max(30, p - 20)) } },
        ]),
      ),
      eliteA: {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(300), "2024": wrSeason(260) },
      },
      eliteB: {
        primaryPosition: "WR",
        seasons: { "2025": wrSeason(390), "2024": wrSeason(340) },
      },
    };
    const anchors = buildFpAnchors(profiles, 1);
    const richAnchors = buildRichStatAnchors(profiles, 1);
    const league: LeagueContext = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr: 1, leagueSize: 12 };
    const vbd = computeVbdComputation(profiles, 1, league);
    const tradeSpine = buildTradeSpinePrecompute(profiles, 1, vbd.bySleeperId, richAnchors, anchors);
    const fp = {
      snapshotAsOf: "2099-01-01",
      profiles,
      anchors,
      richAnchors,
      vbdBySleeperId: vbd.bySleeperId,
      vbdScale: vbd.scale,
      tradeSpine,
    };
    const a = productionBaseTradePoints(profiles.eliteA, "WR", 1, fp);
    const b = productionBaseTradePoints(profiles.eliteB, "WR", 1, fp);
    expect(b.basePoints).toBeGreaterThan(a.basePoints);
    expect(b.basePoints - a.basePoints).toBeGreaterThan(400);
  });
});

describe("scorePick", () => {
  it("values nearer-year picks at least as high as far-year with same anchor", () => {
    const providers = neutralProviders(0.5, true);
    const near = scorePick(
      { year: new Date().getUTCFullYear(), round: 2, bucket: "mid", anchorValue: 2000 },
      providers,
    );
    const far = scorePick(
      { year: new Date().getUTCFullYear() + 3, round: 2, bucket: "mid", anchorValue: 2000 },
      providers,
    );
    expect(near.value).toBeGreaterThanOrEqual(far.value);
  });
});
