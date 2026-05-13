import { describe, expect, it } from "vitest";
import {
  buildFpAnchors,
  productionBaseTradePoints,
  stretchCombinedNorm01,
  type PlayerFantasyProfile,
} from "@/lib/trade-model/fp-baseline";
import { scorePlayer } from "@/lib/trade-model/score-player";
import { scorePick } from "@/lib/trade-model/score-pick";
import type { LeagueContext, TradeModelProviders } from "@/lib/trade-model/types";
import { BUZZ_MAX_POINTS, buzzTweakPoints } from "@/lib/trade-model/weights";

const neutralLeague: LeagueContext = { superflex: false, ppr: 1, leagueSize: 12 };

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
        "2024": wrSeason(p),
        "2023": wrSeason(Math.max(25, p - 30)),
      },
    };
  });
  return out;
}

function mkFp(extra: Record<string, PlayerFantasyProfile>, ppr: LeagueContext["ppr"] = 1) {
  const profiles = { ...seedWrProfiles(), ...extra };
  return {
    snapshotAsOf: "2099-01-01",
    profiles,
    anchors: buildFpAnchors(profiles, ppr),
  };
}

const fixedPlayer = {
  sleeperPlayerId: "999",
  positionLabel: "WR",
  searchRank: 120,
  trendingAdds: 4,
  age: 25,
  yearsExp: 3,
};

describe("scorePlayer", () => {
  it("raises value when team offense tier increases (all else equal)", () => {
    const fp = mkFp({
      "999": {
        primaryPosition: "WR",
        seasons: { "2024": wrSeason(160), "2023": wrSeason(140) },
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
        seasons: { "2024": wrSeason(160), "2023": wrSeason(140) },
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
        seasons: { "2024": wrSeason(380), "2023": wrSeason(300) },
      },
      scrub: {
        primaryPosition: "WR",
        seasons: { "2024": wrSeason(48), "2023": wrSeason(40) },
      },
    });
    const buzz = { searchRank: 400, trendingAdds: 10, age: 24, yearsExp: 2 };
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

describe("stretchCombinedNorm01", () => {
  it("expands separation in the elite band vs identity mapping", () => {
    const a = stretchCombinedNorm01(0.86);
    const b = stretchCombinedNorm01(0.94);
    expect(b - a).toBeGreaterThan(0.94 - 0.86);
  });
});

describe("productionBaseTradePoints elite tail", () => {
  it("assigns meaningfully wider basePoints between two high-end WR profiles than raw norm delta alone", () => {
    const profiles: Record<string, PlayerFantasyProfile> = {
      ...Object.fromEntries(
        [40, 55, 70, 85, 100, 115, 130, 145].map((p, i) => [
          `fill_${i}`,
          { primaryPosition: "WR" as const, seasons: { "2024": wrSeason(p), "2023": wrSeason(Math.max(30, p - 20)) } },
        ]),
      ),
      eliteA: {
        primaryPosition: "WR",
        seasons: { "2024": wrSeason(300), "2023": wrSeason(260) },
      },
      eliteB: {
        primaryPosition: "WR",
        seasons: { "2024": wrSeason(390), "2023": wrSeason(340) },
      },
    };
    const anchors = buildFpAnchors(profiles, 1);
    const a = productionBaseTradePoints(profiles.eliteA, "WR", 1, anchors);
    const b = productionBaseTradePoints(profiles.eliteB, "WR", 1, anchors);
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
