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
  vbdPoints: 400,
  draftCapitalPoints: 160,
};
export const FP_BASE = { baseMin: 1400, baseSpan: 11_200, globalBlend: 0.45, richStatBlend: 0.09 };
export const VALUE_MIN = 400;
export const VALUE_MAX = 19_000;
export const SKILL_ORDER = ["QB", "RB", "WR", "TE"];

export const DEFAULT_STARTING_SLOTS = {
  startQb: 1,
  startRb: 2,
  startWr: 2,
  startTe: 1,
  startFlex: 1,
};

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
  let raw;
  if (ppr >= 1) raw = row.pts_ppr;
  else if (ppr >= 0.5) raw = row.pts_half_ppr;
  else raw = row.pts_std;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

const FP_SEASON_ORDER_DESC = ["2025", "2024", "2023"];

function presentFpSeasonKeysDesc(seasons) {
  const out = [];
  for (const y of FP_SEASON_ORDER_DESC) {
    if (seasons[y]) out.push(y);
  }
  return out;
}

function fpRecencyWeights(count) {
  if (count === 1) return [1];
  if (count === 2) return [0.65, 0.35];
  if (count === 3) return [0.5, 0.35, 0.15];
  throw new Error(`fpRecencyWeights: unsupported season count ${count}`);
}

export function weightedSeasonTotals(profile, ppr) {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  if (keys.length === 0) return { weightedPts: 0, seasonsUsed: 0 };
  const w = fpRecencyWeights(keys.length);
  let weightedPts = 0;
  for (let i = 0; i < keys.length; i++) {
    const row = profile.seasons[keys[i]];
    weightedPts += w[i] * pickPts(row, ppr);
  }
  return { weightedPts, seasonsUsed: keys.length };
}

export function weightedPpg(profile, ppr) {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  const usable = keys.filter((y) => {
    const r = profile.seasons[y];
    if (!r) return false;
    const p = pickPts(r, ppr);
    const g = r.games ?? 0;
    return Number.isFinite(p) && g > 0;
  });
  if (usable.length === 0) return { wppg: 0, gamesWeight: 0 };
  const w = fpRecencyWeights(usable.length);
  let wppgAcc = 0;
  let gamesWeight = 0;
  for (let i = 0; i < usable.length; i++) {
    const y = usable[i];
    const r = profile.seasons[y];
    const p = pickPts(r, ppr);
    const g = r.games ?? 0;
    wppgAcc += w[i] * (p / g);
    gamesWeight += w[i] * g;
  }
  return { wppg: wppgAcc, gamesWeight };
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
    if (weightedPts > 0) globals.push(Math.log1p(Math.max(0, weightedPts)));
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

export function weightedNumericFromSeasons(profile, picker) {
  const keys = presentFpSeasonKeysDesc(profile.seasons);
  if (keys.length === 0) return null;
  const w = fpRecencyWeights(keys.length);
  let acc = 0;
  let sumW = 0;
  for (let i = 0; i < keys.length; i++) {
    const row = profile.seasons[keys[i]];
    const v = picker(row);
    if (typeof v === "number" && Number.isFinite(v)) {
      acc += w[i] * v;
      sumW += w[i];
    }
  }
  if (sumW <= 0) return null;
  return acc / sumW;
}

export function buildRichStatAnchors(profiles, _ppr) {
  const wrTeShares = [];
  const rbTpg = [];
  const qbEpa = [];
  for (const p of Object.values(profiles)) {
    const primary = p.primaryPosition;
    const ts = weightedNumericFromSeasons(p, (r) => r.target_share);
    const tpg = weightedNumericFromSeasons(p, (r) => {
      const g = r.games ?? 0;
      if (g <= 0) return undefined;
      const touches =
        typeof r.touches === "number" && Number.isFinite(r.touches)
          ? r.touches
          : typeof r.carries === "number" && typeof r.targets === "number"
            ? r.carries + r.targets
            : undefined;
      if (touches == null || !Number.isFinite(touches)) return undefined;
      return touches / g;
    });
    const epa = weightedNumericFromSeasons(p, (r) => r.passing_epa);
    if ((primary === "WR" || primary === "TE") && ts != null && ts > 0) wrTeShares.push(ts);
    if (primary === "RB" && tpg != null && tpg > 0) rbTpg.push(tpg);
    if (primary === "QB" && epa != null && Number.isFinite(epa)) qbEpa.push(epa);
  }
  wrTeShares.sort((x, y) => x - y);
  rbTpg.sort((x, y) => x - y);
  qbEpa.sort((x, y) => x - y);
  return {
    wrTeTargetShare: quantileAnchors(wrTeShares, 0.05, 0.95),
    rbTouchesPerGame: quantileAnchors(rbTpg, 0.05, 0.95),
    qbPassingEpa: quantileAnchors(qbEpa, 0.05, 0.95),
  };
}

function richUsageNorm01(profile, primary, richAnchors) {
  if (!richAnchors) return 0.5;
  if (primary === "WR" || primary === "TE") {
    const v = weightedNumericFromSeasons(profile, (r) => r.target_share);
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.wrTeTargetShare);
  }
  if (primary === "RB") {
    const v = weightedNumericFromSeasons(profile, (r) => {
      const g = r.games ?? 0;
      if (g <= 0) return undefined;
      const touches =
        typeof r.touches === "number" && Number.isFinite(r.touches)
          ? r.touches
          : typeof r.carries === "number" && typeof r.targets === "number"
            ? r.carries + r.targets
            : undefined;
      if (touches == null || !Number.isFinite(touches)) return undefined;
      return touches / g;
    });
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.rbTouchesPerGame);
  }
  if (primary === "QB") {
    const v = weightedNumericFromSeasons(profile, (r) => r.passing_epa);
    if (v == null) return 0.5;
    return normFromAnchors(v, richAnchors.qbPassingEpa);
  }
  return 0.5;
}

export function productionBaseTradePoints(profile, fp, ppr) {
  const anchors = fp.anchors;
  const richAnchors = fp.richAnchors ?? null;
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
  const globalNorm = normFromAnchors(weightedPts > 0 ? Math.log1p(Math.max(0, weightedPts)) : 0, anchors.globalLogPts);
  const g = FP_BASE.globalBlend;
  const blendedPts = (1 - g) * posNorm + g * globalNorm;
  const usage01 = richUsageNorm01(profile, primary, richAnchors);
  const rb = FP_BASE.richStatBlend;
  const blendedRaw = (1 - rb) * blendedPts + rb * usage01;
  const combinedNorm01 = stretchCombinedNorm01(blendedRaw);
  const basePoints = Math.round(FP_BASE.baseMin + combinedNorm01 * FP_BASE.baseSpan);
  const seasonKeys = presentFpSeasonKeysDesc(profile.seasons);
  const maxG = Math.max(0, ...seasonKeys.map((y) => profile.seasons[y]?.games ?? 0), gamesWeight);
  const gamesParticipation01 = clamp01(maxG / 17);
  const missing = weightedPts <= 0 && wppg <= 0;
  return { basePoints, combinedNorm01, missing, gamesParticipation01 };
}

export function flexStartersPerSkill(leagueSize, startFlex) {
  const pool = leagueSize * startFlex;
  if (pool <= 0) return { rb: 0, wr: 0, te: 0 };
  const base = Math.floor(pool / 3);
  const rem = pool - base * 3;
  return {
    rb: base + (rem >= 1 ? 1 : 0),
    wr: base + (rem >= 2 ? 1 : 0),
    te: base,
  };
}

function listByPosition(profiles, pos, ppr) {
  return Object.entries(profiles)
    .filter(([, p]) => p.primaryPosition === pos)
    .map(([id, p]) => ({ id, proj: weightedSeasonTotals(p, ppr).weightedPts }))
    .sort((a, b) => b.proj - a.proj);
}

function baselinePoints(sorted, startersLeagueWide) {
  if (sorted.length === 0 || startersLeagueWide <= 0) return 0;
  const idx = Math.min(Math.max(0, startersLeagueWide - 1), sorted.length - 1);
  return sorted[idx].proj;
}

export function computeVbdComputation(profiles, ppr, league) {
  const T = league.leagueSize;
  const flex = flexStartersPerSkill(T, league.startFlex);
  const startersQb = T * league.startQb;
  const startersRb = T * league.startRb + flex.rb;
  const startersWr = T * league.startWr + flex.wr;
  const startersTe = T * league.startTe + flex.te;
  const qbL = listByPosition(profiles, "QB", ppr);
  const rbL = listByPosition(profiles, "RB", ppr);
  const wrL = listByPosition(profiles, "WR", ppr);
  const teL = listByPosition(profiles, "TE", ppr);
  const bQb = baselinePoints(qbL, startersQb);
  const bRb = baselinePoints(rbL, startersRb);
  const bWr = baselinePoints(wrL, startersWr);
  const bTe = baselinePoints(teL, startersTe);
  const bySleeperId = {};
  for (const row of qbL) bySleeperId[row.id] = row.proj - bQb;
  for (const row of rbL) bySleeperId[row.id] = row.proj - bRb;
  for (const row of wrL) bySleeperId[row.id] = row.proj - bWr;
  for (const row of teL) bySleeperId[row.id] = row.proj - bTe;
  const vals = Object.values(bySleeperId)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let scale = null;
  if (vals.length >= 12) {
    const lo = vals[Math.max(0, Math.floor(0.1 * (vals.length - 1)))];
    const hi = vals[Math.min(vals.length - 1, Math.ceil(0.9 * (vals.length - 1)))];
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) scale = { lo, hi };
  }
  return { bySleeperId, scale };
}

export function nflDraftRoundTier01(round) {
  if (round == null || !Number.isFinite(round) || round < 1) return { tier01: NEUTRAL, missing: true };
  const r = Math.min(7, Math.floor(round));
  const table = { 1: 0.9, 2: 0.8, 3: 0.68, 4: 0.58, 5: 0.52, 6: 0.48, 7: 0.46 };
  return { tier01: clamp01(table[r] ?? 0.45), missing: false };
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
  const peak = pos === "QB" ? 30 : pos === "RB" ? 24 : 26;
  const width = pos === "QB" ? 6.8 : pos === "RB" ? 3.8 : 5.2;
  const z = (peak - ageYears) / width;
  return { tier01: clamp01(1 / (1 + Math.exp(-z))), missing: false };
}

export function peakYearsRemaining01(ageYears, positionLabel) {
  if (ageYears == null || !Number.isFinite(ageYears)) return { years01: 0.5, missing: true };
  const pos = primarySkillForCurve(positionLabel);
  const cliff = pos === "QB" ? 34 : pos === "RB" ? 28 : 30;
  const span = pos === "QB" ? 14 : pos === "RB" ? 10 : 12;
  const raw = Math.max(0, cliff - ageYears);
  return { years01: clamp01(Math.min(1, raw / span)), missing: false };
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
  const prod = productionBaseTradePoints(profile, fp, league.ppr);

  components.push({
    key: "fantasyProduction",
    label: "Fantasy production (recent seasons, PPR-aware + usage blend)",
    contribution: prod.basePoints,
    missing: prod.missing,
  });

  const vbdRaw = fp.vbdBySleeperId?.[input.sleeperPlayerId];
  let vbdMissing = true;
  let vbdContrib = 0;
  if (vbdRaw != null && Number.isFinite(vbdRaw)) {
    if (fp.vbdScale && fp.vbdScale.hi > fp.vbdScale.lo) {
      vbdMissing = false;
      const norm = clamp01((vbdRaw - fp.vbdScale.lo) / (fp.vbdScale.hi - fp.vbdScale.lo));
      const baseAdj = (norm - NEUTRAL) * 2 * MODEL_WEIGHTS.vbdPoints;
      const pk = peakYearsRemaining01(input.age, input.positionLabel);
      const dyn = pk.missing ? 1 : 0.35 + 0.65 * pk.years01;
      vbdContrib = Math.round(baseAdj * dyn);
    } else {
      vbdMissing = false;
      vbdContrib = Math.round(Math.tanh(vbdRaw / 95) * MODEL_WEIGHTS.vbdPoints * 0.85);
    }
  }
  components.push({
    key: "vbdDynasty",
    label: "League VBD proxy (retrospective FP vs starter baselines × peak years)",
    contribution: vbdContrib,
    missing: vbdMissing,
  });

  const draftT = nflDraftRoundTier01(input.nflDraftRound ?? null);
  components.push({
    key: "draftCapital",
    label: "NFL draft capital (early rounds)",
    contribution: (draftT.tier01 - NEUTRAL) * MODEL_WEIGHTS.draftCapitalPoints,
    missing: draftT.missing,
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
