import { ageCurve01 } from "@/lib/trade-model/age-curve";
import {
  type FpScoringContext,
  productionBaseTradePoints,
} from "@/lib/trade-model/fp-baseline";
import type { EvaluationComponent, LeagueContext, PlayerScoreInput, ScoreResult, TradeModelProviders } from "@/lib/trade-model/types";
import {
  BUZZ_MAX_POINTS,
  MODEL_WEIGHTS,
  applyLeagueFormatToPlayerValue,
  buzzTweakPoints,
  futureOutlookRaw,
  leagueSizeTilt01,
  pprReceiverTilt01,
} from "@/lib/trade-model/weights";
import { SUPERFLEX_QB_MULTIPLIER } from "@/lib/trade-types";

const NEUTRAL = 0.5;
const VALUE_MIN = 400;
const VALUE_MAX = 19_000;

function clampValue(n: number): number {
  return Math.round(Math.max(VALUE_MIN, Math.min(VALUE_MAX, n)));
}

function isReceiverHeavyPosition(positionLabel: string): boolean {
  const u = positionLabel.toUpperCase();
  return u.includes("WR") || u.includes("RB") || u.includes("TE");
}

function isQuarterbackOnly(positionLabel: string): boolean {
  return positionLabel
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .some((p) => p === "QB");
}

export function scorePlayer(
  input: PlayerScoreInput,
  providers: TradeModelProviders,
  league: LeagueContext,
  fp: FpScoringContext,
): ScoreResult {
  const components: EvaluationComponent[] = [];

  const profile = fp.profiles[input.sleeperPlayerId];
  const prod = productionBaseTradePoints(profile, input.positionLabel, league.ppr, fp.anchors);

  components.push({
    key: "fantasyProduction",
    label: "Fantasy production (recent seasons, PPR-aware)",
    contribution: prod.basePoints,
    missing: prod.missing,
  });

  if (profile && !prod.missing) {
    const durAdj = (prod.gamesParticipation01 - NEUTRAL) * MODEL_WEIGHTS.gamesPlayedPoints;
    components.push({
      key: "gamesPlayed",
      label: "Games played / availability (from stat seasons)",
      contribution: durAdj,
    });
  } else {
    const hist = providers.history.getHistoryTier(input.sleeperPlayerId);
    const histAdj = (hist.tier01 - NEUTRAL) * MODEL_WEIGHTS.curatedHistoryPoints;
    components.push({
      key: "historyCurated",
      label: "Recent form fallback (curated — used when fantasy snapshot lacks this player)",
      contribution: histAdj,
      missing: hist.missing,
    });
  }

  const team = providers.teamOffense.getTeamOffense(input.teamAbbr);
  const teamAdj = (team.tier01 - NEUTRAL) * MODEL_WEIGHTS.teamOffensePoints;
  components.push({
    key: "teamOffense",
    label: "Team offense (curated tier)",
    contribution: teamAdj,
    missing: team.missing,
  });

  const seasonYear = new Date().getUTCFullYear();
  const oc = providers.coordinator.getOcQuality(input.teamAbbr, seasonYear);
  const ocAdj = (oc.tier01 - NEUTRAL) * MODEL_WEIGHTS.ocPoints;
  components.push({
    key: "oc",
    label: `OC / scheme (${seasonYear})`,
    contribution: ocAdj,
    missing: oc.missing,
  });

  const role = providers.role.getRoleTier(input.sleeperPlayerId);
  const roleAdj = (role.tier01 - NEUTRAL) * MODEL_WEIGHTS.rolePoints;
  components.push({
    key: "role",
    label: "Depth / usage role (curated)",
    contribution: roleAdj,
    missing: role.missing,
  });

  const inj = providers.injury.getAvailabilityTier(input.sleeperPlayerId);
  const injAdj = (inj.tier01 - NEUTRAL) * MODEL_WEIGHTS.injuryPoints;
  components.push({
    key: "availability",
    label: "Availability / injury signal (curated)",
    contribution: injAdj,
    missing: inj.missing,
  });

  const ageC = ageCurve01(input.age, input.positionLabel);
  const ageAdj = (ageC.tier01 - NEUTRAL) * MODEL_WEIGHTS.agePoints;
  components.push({
    key: "age",
    label: "Age / positional prime curve",
    contribution: ageAdj,
    missing: ageC.missing,
  });

  const outlook = futureOutlookRaw({
    age01: ageC.tier01,
    team01: team.tier01,
    role01: role.tier01,
    missingAge: ageC.missing,
    missingTeam: team.missing,
    missingRole: role.missing,
  });
  const futAdj = (outlook.value01 - NEUTRAL) * MODEL_WEIGHTS.futureBlendPoints;
  components.push({
    key: "futureOutlook",
    label: "Future outlook blend",
    contribution: futAdj,
    missing: outlook.missing,
  });

  let leagueFormatAdj = 0;
  const pprTilt = pprReceiverTilt01(league.ppr);
  const sizeTilt = leagueSizeTilt01(league.leagueSize);
  if (isReceiverHeavyPosition(input.positionLabel)) {
    leagueFormatAdj += (pprTilt - NEUTRAL) * MODEL_WEIGHTS.leagueFormatReceiverPoints;
  }
  leagueFormatAdj += (sizeTilt - NEUTRAL) * MODEL_WEIGHTS.leagueFormatSizePoints;
  components.push({
    key: "leagueFormat",
    label: "League format tilt (PPR + size)",
    contribution: leagueFormatAdj,
  });

  const buzzAdj = buzzTweakPoints(input.searchRank, input.trendingAdds, BUZZ_MAX_POINTS);
  components.push({
    key: "marketBuzz",
    label: `Sleeper buzz (capped ±${BUZZ_MAX_POINTS})`,
    contribution: buzzAdj,
  });

  const preSuperflex = components.reduce((a, c) => a + c.contribution, 0);
  const withLeague = applyLeagueFormatToPlayerValue(preSuperflex, league, input.positionLabel, SUPERFLEX_QB_MULTIPLIER);

  if (league.superflex && isQuarterbackOnly(input.positionLabel)) {
    components.push({
      key: "superflexQb",
      label: `Superflex QB ×${SUPERFLEX_QB_MULTIPLIER}`,
      contribution: withLeague - preSuperflex,
    });
  }

  const value = clampValue(withLeague);

  let conf = 1;
  if (prod.missing) conf -= 0.22;
  for (const c of components) {
    if (c.missing) conf -= 0.07;
  }
  const confidence01 = clamp01(conf);

  return { value, confidence01, components };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
