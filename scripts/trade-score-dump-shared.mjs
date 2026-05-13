/**
 * Shared trade model scoring for Node dump scripts (mirrors src/lib/trade-model/*).
 * Keep in sync when weights or fp-baseline logic change.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const NEUTRAL = 0.5;
export const SUPERFLEX_QB_MULTIPLIER = 1.22;
export const BUZZ_MAX_POINTS = 140;
export const MODEL_WEIGHTS = {
  teamOffensePoints: 320,
  ocPoints: 220,
  curatedHistoryPoints: 260,
  gamesPlayedPoints: 200,
  rolePoints: 360,
  injuryPoints: 260,
  agePoints: 520,
  futureBlendPoints: 200,
  leagueFormatReceiverPoints: 180,
  leagueFormatSizePoints: 120,
};
export const FP_BASE = { baseMin: 1400, baseSpan: 11_200, globalBlend: 0.45 };
export const VALUE_MIN = 400;
export const VALUE_MAX = 19_000;
export const SKILL_ORDER = ["QB", "RB", "WR", "TE"];

export function stretchCombinedNorm01(raw) {
  const knee = 0.82;
  const outKnee = 0.62;
  const t = clamp01(raw);
  if (t <= knee) return clamp01((t / knee) * outKnee);
  return clamp01(outKnee + ((t - knee) / (1 - knee)) * (1 - outKnee));
}

export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export function clampValue(n) {
  return Math.round(Math.max(VALUE_MIN, Math.min(VALUE_MAX, n)));
}

export function pickPts(row, ppr) {
  if (ppr >= 1) return row.pts_ppr;
  if (ppr >= 0.5) return row.pts_half_ppr;
  return row.pts_std;
}

export function weightedSeasonTotals(profile, ppr) {
  const s24 = profile.seasons["2024"];
  const s23 = profile.seasons["2023"];
  const p24 = s24 ? pickPts(s24, ppr) : null;
  const p23 = s23 ? pickPts(s23, ppr) : null;
  if (p24 != null && p23 != null) return { weightedPts: 0.65 * p24 + 0.35 * p23, seasonsUsed: 2 };
  if (p24 != null) return { weightedPts: p24, seasonsUsed: 1 };
  if (p23 != null) return { weightedPts: p23, seasonsUsed: 1 };
  return { weightedPts: 0, seasonsUsed: 0 };
}

export function weightedPpg(profile, ppr) {
  const s24 = profile.seasons["2024"];
  const s23 = profile.seasons["2023"];
  const p24 = s24 ? pickPts(s24, ppr) : null;
  const g24 = s24?.games ?? 0;
  const p23 = s23 ? pickPts(s23, ppr) : null;
  const g23 = s23?.games ?? 0;
  if (p24 != null && p23 != null && g24 > 0 && g23 > 0) {
    return { wppg: 0.65 * (p24 / g24) + 0.35 * (p23 / g23), gamesWeight: 0.65 * g24 + 0.35 * g23 };
  }
  if (p24 != null && g24 > 0) return { wppg: p24 / g24, gamesWeight: g24 };
  if (p23 != null && g23 > 0) return { wppg: p23 / g23, gamesWeight: g23 };
  return { wppg: 0, gamesWeight: 0 };
}

export function quantileAnchors(sorted, qLo, qHi) {
  const n = sorted.length;
  if (n < 8) return null;
  const lo = sorted[Math.max(0, Math.floor(qLo * (n - 1)))];
  const hi = sorted[Math.min(n - 1, Math.ceil(qHi * (n - 1)))];
  if (!(hi > lo)) return { lo: lo - 1e-6, hi: lo + 1e-3, n };
  return { lo, hi, n };
}

export function normFromAnchors(value, a) {
  if (!a) return 0.5;
  return clamp01((value - a.lo) / (a.hi - a.lo));
}

export function buildFpAnchors(profiles, ppr) {
  const byPos = { QB: [], RB: [], WR: [], TE: [] };
  const globals = [];
  for (const p of Object.values(profiles)) {
    const { wppg } = weightedPpg(p, ppr);
    const { weightedPts } = weightedSeasonTotals(p, ppr);
    if (weightedPts > 0) globals.push(Math.log1p(weightedPts));
    if (wppg > 0 && p.primaryPosition) byPos[p.primaryPosition].push(wppg);
  }
  const positionalWppg = {};
  for (const pos of SKILL_ORDER) {
    const arr = byPos[pos].sort((x, y) => x - y);
    positionalWppg[pos] = quantileAnchors(arr, 0.05, 0.95);
  }
  const globalLogPts = quantileAnchors(globals.sort((x, y) => x - y), 0.05, 0.95);
  return { positionalWppg, globalLogPts };
}

export function productionBaseTradePoints(profile, anchors, ppr) {
  if (!profile) {
    const combinedNorm01 = stretchCombinedNorm01(0.42);
    return {
      basePoints: Math.round(FP_BASE.baseMin + combinedNorm01 * FP_BASE.baseSpan),
      combinedNorm01,
      missing: true,
      gamesParticipation01: 0.5,
    };
  }
  const primary = profile.primaryPosition;
  const { wppg, gamesWeight } = weightedPpg(profile, ppr);
  const { weightedPts } = weightedSeasonTotals(profile, ppr);
  const posNorm = normFromAnchors(wppg, anchors.positionalWppg[primary]);
  const globalNorm = normFromAnchors(weightedPts > 0 ? Math.log1p(weightedPts) : 0, anchors.globalLogPts);
  const g = FP_BASE.globalBlend;
  const blendedRaw = (1 - g) * posNorm + g * globalNorm;
  const combinedNorm01 = stretchCombinedNorm01(blendedRaw);
  const basePoints = Math.round(FP_BASE.baseMin + combinedNorm01 * FP_BASE.baseSpan);
  const maxG = Math.max(
    profile.seasons["2024"]?.games ?? 0,
    profile.seasons["2023"]?.games ?? 0,
    gamesWeight,
  );
  const gamesParticipation01 = clamp01(maxG / 17);
  const missing = weightedPts <= 0 && wppg <= 0;
  return { basePoints, combinedNorm01, missing, gamesParticipation01 };
}

export function tierFromMap(map, key) {
  const v = map?.[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return { tier01: NEUTRAL, missing: true };
  return { tier01: clamp01(v), missing: false };
}

export function createProviders(snapshot) {
  const neutralDraft = { getClassStrength01: () => ({ tier01: NEUTRAL, missing: true }) };
  return {
    teamOffense: { getTeamOffense: (abbr) => tierFromMap(snapshot.teamOffense01, abbr.trim().toUpperCase()) },
    coordinator: { getOcQuality: (abbr, y) => tierFromMap(snapshot.ocQuality01, `${abbr.trim().toUpperCase()}:${y}`) },
    history: { getHistoryTier: (id) => tierFromMap(snapshot.playerHistory01, id) },
    role: { getRoleTier: (id) => tierFromMap(snapshot.playerRole01, id) },
    injury: { getAvailabilityTier: (id) => tierFromMap(snapshot.injuryAvailability01, id) },
    draftClass: neutralDraft,
  };
}

export function buzzTweakPoints(searchRank, trendingAdds) {
  const sr = searchRank ?? 950;
  const inv = 1 - Math.min(Math.max(sr, 1), 2200) / 2200;
  const ta = Math.min(Math.max(trendingAdds, 0), 120) / 120;
  const mix = 0.78 * inv + 0.22 * ta;
  return (mix - NEUTRAL) * 2 * BUZZ_MAX_POINTS;
}

export function primarySkillForCurve(positionLabel) {
  const parts = positionLabel.split(",").map((p) => p.trim().toUpperCase());
  for (const pos of SKILL_ORDER) if (parts.includes(pos)) return pos;
  return null;
}

export function ageCurve01(ageYears, positionLabel) {
  if (ageYears == null || !Number.isFinite(ageYears)) return { tier01: NEUTRAL, missing: true };
  const pos = primarySkillForCurve(positionLabel);
  if (pos == null) {
    const z = (26.5 - ageYears) / 6;
    return { tier01: clamp01(1 / (1 + Math.exp(-z))), missing: false };
  }
  const peak = pos === "QB" ? 29 : pos === "RB" ? 24.5 : 26.5;
  const width = pos === "QB" ? 7 : pos === "RB" ? 4.5 : 6;
  const z = (peak - ageYears) / width;
  return { tier01: clamp01(1 / (1 + Math.exp(-z))), missing: false };
}

export function futureOutlookRaw(input) {
  const parts = [];
  if (!input.missingAge) parts.push(input.age01);
  parts.push(input.missingTeam ? NEUTRAL : input.team01);
  if (!input.missingRole) parts.push(input.role01);
  if (parts.length === 0) return { value01: NEUTRAL, missing: true };
  const v = parts.reduce((a, b) => a + b, 0) / parts.length;
  const allMissing = input.missingAge && input.missingTeam && input.missingRole;
  return { value01: v, missing: allMissing };
}

export function pprReceiverTilt01(ppr) {
  if (ppr >= 1) return 0.55;
  if (ppr >= 0.5) return 0.52;
  return 0.48;
}

export function leagueSizeTilt01(leagueSize) {
  if (leagueSize <= 8) return 0.48;
  if (leagueSize >= 14) return 0.52;
  return NEUTRAL;
}

export function isReceiverHeavyPosition(positionLabel) {
  const u = positionLabel.toUpperCase();
  return u.includes("WR") || u.includes("RB") || u.includes("TE");
}

export function isQuarterbackOnly(positionLabel) {
  return positionLabel
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .some((p) => p === "QB");
}

export function applyLeagueFormatToPlayerValue(value, league, positionLabel) {
  const isQb = isQuarterbackOnly(positionLabel);
  if (league.superflex && isQb) return Math.round(value * SUPERFLEX_QB_MULTIPLIER);
  return Math.round(value);
}

export function resolveAge(raw) {
  const a = raw.age;
  const y = raw.years_exp;
  if (typeof a === "number" && Number.isFinite(a) && a > 17 && a < 55) return a;
  if (typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 30) return 22 + y;
  return null;
}

export function displayName(raw) {
  const f = (raw.first_name ?? "").trim();
  const l = (raw.last_name ?? "").trim();
  return `${f} ${l}`.trim() || "?";
}

/**
 * @returns {{ value: number, confidence01: number, components: { key: string, contribution: number, missing?: boolean }[], preSuperflexSum: number, preClampSum: number }}
 */
export function scorePlayerDetailed(input, providers, league, fp) {
  const components = [];
  const profile = fp.profiles[input.sleeperPlayerId];
  const prod = productionBaseTradePoints(profile, fp.anchors, league.ppr);

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
  components.push({
    key: "teamOffense",
    label: "Team offense (curated tier)",
    contribution: (team.tier01 - NEUTRAL) * MODEL_WEIGHTS.teamOffensePoints,
    missing: team.missing,
  });

  const seasonYear = new Date().getUTCFullYear();
  const oc = providers.coordinator.getOcQuality(input.teamAbbr, seasonYear);
  components.push({
    key: "oc",
    label: `OC / scheme (${seasonYear})`,
    contribution: (oc.tier01 - NEUTRAL) * MODEL_WEIGHTS.ocPoints,
    missing: oc.missing,
  });

  const role = providers.role.getRoleTier(input.sleeperPlayerId);
  components.push({
    key: "role",
    label: "Depth / usage role (curated)",
    contribution: (role.tier01 - NEUTRAL) * MODEL_WEIGHTS.rolePoints,
    missing: role.missing,
  });

  const inj = providers.injury.getAvailabilityTier(input.sleeperPlayerId);
  components.push({
    key: "availability",
    label: "Availability / injury signal (curated)",
    contribution: (inj.tier01 - NEUTRAL) * MODEL_WEIGHTS.injuryPoints,
    missing: inj.missing,
  });

  const ageC = ageCurve01(input.age, input.positionLabel);
  components.push({
    key: "age",
    label: "Age / positional prime curve",
    contribution: (ageC.tier01 - NEUTRAL) * MODEL_WEIGHTS.agePoints,
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
  components.push({
    key: "futureOutlook",
    label: "Future outlook blend",
    contribution: (outlook.value01 - NEUTRAL) * MODEL_WEIGHTS.futureBlendPoints,
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

  components.push({
    key: "marketBuzz",
    label: `Sleeper buzz (capped ±${BUZZ_MAX_POINTS})`,
    contribution: buzzTweakPoints(input.searchRank, input.trendingAdds),
  });

  const preSuperflex = components.reduce((a, c) => a + c.contribution, 0);
  const withLeague = applyLeagueFormatToPlayerValue(preSuperflex, league, input.positionLabel);

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
  const confidence01 = Math.max(0, Math.min(1, conf));

  const preClampSum = components.reduce((a, c) => a + c.contribution, 0);

  return { value, confidence01, components, preSuperflexSum: preSuperflex, preClampSum };
}

export function loadRepoJson(relFromRoot) {
  const root = path.join(__dirname, "..");
  return JSON.parse(readFileSync(path.join(root, relFromRoot), "utf8"));
}
