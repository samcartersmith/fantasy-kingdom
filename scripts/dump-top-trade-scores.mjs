/**
 * One-off: rank players in the local fantasy snapshot by full trade model score.
 * Uses real Sleeper player rows for team / age / search_rank; trending adds = 0.
 *
 * Run: node scripts/dump-top-trade-scores.mjs
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEUTRAL = 0.5;
const SUPERFLEX_QB_MULTIPLIER = 1.22;
const BUZZ_MAX_POINTS = 140;
const MODEL_WEIGHTS = {
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
const FP_BASE = { baseMin: 1400, baseSpan: 11_200, globalBlend: 0.45 };
const VALUE_MIN = 400;
const VALUE_MAX = 19_000;
const SKILL_ORDER = ["QB", "RB", "WR", "TE"];

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) reject(new Error(String(res.statusCode)));
          else resolve(JSON.parse(body));
        });
      })
      .on("error", reject);
  });
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function pickPts(row, ppr) {
  if (ppr >= 1) return row.pts_ppr;
  if (ppr >= 0.5) return row.pts_half_ppr;
  return row.pts_std;
}

function weightedSeasonTotals(profile, ppr) {
  const s24 = profile.seasons["2024"];
  const s23 = profile.seasons["2023"];
  const p24 = s24 ? pickPts(s24, ppr) : null;
  const p23 = s23 ? pickPts(s23, ppr) : null;
  if (p24 != null && p23 != null) return { weightedPts: 0.65 * p24 + 0.35 * p23 };
  if (p24 != null) return { weightedPts: p24 };
  if (p23 != null) return { weightedPts: p23 };
  return { weightedPts: 0 };
}

function weightedPpg(profile, ppr) {
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

function percentileAnchors(sorted) {
  const n = sorted.length;
  if (n < 8) return null;
  const p10 = sorted[Math.max(0, Math.floor(0.1 * (n - 1)))];
  const p90 = sorted[Math.min(n - 1, Math.ceil(0.9 * (n - 1)))];
  if (!(p90 > p10)) return { p10: p10 - 1e-6, p90: p10 + 1e-3, n };
  return { p10, p90, n };
}

function buildFpAnchors(profiles, ppr) {
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
    positionalWppg[pos] = percentileAnchors(arr);
  }
  const globalLogPts = percentileAnchors(globals.sort((x, y) => x - y));
  return { positionalWppg, globalLogPts };
}

function normFromAnchors(value, a) {
  if (!a) return 0.5;
  return clamp01((value - a.p10) / (a.p90 - a.p10));
}

function productionBaseTradePoints(profile, anchors, ppr) {
  if (!profile) {
    return {
      basePoints: Math.round(FP_BASE.baseMin + 0.42 * FP_BASE.baseSpan),
      missing: true,
      gamesParticipation01: 0.5,
    };
  }
  const primary = profile.primaryPosition;
  const { wppg, gamesWeight } = weightedPpg(profile, ppr);
  const { weightedPts } = weightedSeasonTotals(profile, ppr);
  const posNorm = normFromAnchors(wppg, anchors.positionalWppg[primary]);
  const globalNorm = normFromAnchors(weightedPts > 0 ? Math.log1p(weightedPts) : 0, anchors.globalLogPts);
  const combinedNorm01 = (1 - FP_BASE.globalBlend) * posNorm + FP_BASE.globalBlend * globalNorm;
  const basePoints = Math.round(FP_BASE.baseMin + combinedNorm01 * FP_BASE.baseSpan);
  const maxG = Math.max(
    profile.seasons["2024"]?.games ?? 0,
    profile.seasons["2023"]?.games ?? 0,
    gamesWeight,
  );
  const gamesParticipation01 = clamp01(maxG / 17);
  const missing = weightedPts <= 0 && wppg <= 0;
  return { basePoints, missing, gamesParticipation01 };
}

function tierFromMap(map, key) {
  const v = map?.[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return { tier01: NEUTRAL, missing: true };
  return { tier01: clamp01(v), missing: false };
}

function createProviders(snapshot) {
  return {
    teamOffense: { getTeamOffense: (abbr) => tierFromMap(snapshot.teamOffense01, abbr.trim().toUpperCase()) },
    coordinator: { getOcQuality: (abbr, y) => tierFromMap(snapshot.ocQuality01, `${abbr.trim().toUpperCase()}:${y}`) },
    history: { getHistoryTier: (id) => tierFromMap(snapshot.playerHistory01, id) },
    role: { getRoleTier: (id) => tierFromMap(snapshot.playerRole01, id) },
    injury: { getAvailabilityTier: (id) => tierFromMap(snapshot.injuryAvailability01, id) },
  };
}

function buzzTweakPoints(searchRank, trendingAdds) {
  const sr = searchRank ?? 950;
  const inv = 1 - Math.min(Math.max(sr, 1), 2200) / 2200;
  const ta = Math.min(Math.max(trendingAdds, 0), 120) / 120;
  const mix = 0.78 * inv + 0.22 * ta;
  return (mix - NEUTRAL) * 2 * BUZZ_MAX_POINTS;
}

function primarySkillForCurve(positionLabel) {
  const parts = positionLabel.split(",").map((p) => p.trim().toUpperCase());
  for (const pos of SKILL_ORDER) if (parts.includes(pos)) return pos;
  return null;
}

function ageCurve01(ageYears, positionLabel) {
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

function futureOutlookRaw(input) {
  const parts = [];
  if (!input.missingAge) parts.push(input.age01);
  if (!input.missingTeam) parts.push(input.team01);
  if (!input.missingRole) parts.push(input.role01);
  if (parts.length === 0) return { value01: NEUTRAL, missing: true };
  return { value01: parts.reduce((a, b) => a + b, 0) / parts.length, missing: false };
}

function pprReceiverTilt01(ppr) {
  if (ppr >= 1) return 0.55;
  if (ppr >= 0.5) return 0.52;
  return 0.48;
}

function leagueSizeTilt01(leagueSize) {
  if (leagueSize <= 8) return 0.48;
  if (leagueSize >= 14) return 0.52;
  return NEUTRAL;
}

function isReceiverHeavyPosition(positionLabel) {
  const u = positionLabel.toUpperCase();
  return u.includes("WR") || u.includes("RB") || u.includes("TE");
}

function isQuarterbackOnly(positionLabel) {
  return positionLabel
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .some((p) => p === "QB");
}

function applyLeagueFormatToPlayerValue(value, league, positionLabel) {
  const isQb = isQuarterbackOnly(positionLabel);
  if (league.superflex && isQb) return Math.round(value * SUPERFLEX_QB_MULTIPLIER);
  return Math.round(value);
}

function resolveAge(raw) {
  const a = raw.age;
  const y = raw.years_exp;
  if (typeof a === "number" && Number.isFinite(a) && a > 17 && a < 55) return a;
  if (typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 30) return 22 + y;
  return null;
}

function scorePlayer(input, providers, league, fp) {
  const profile = fp.profiles[input.sleeperPlayerId];
  const prod = productionBaseTradePoints(profile, fp.anchors, league.ppr);
  let sum = prod.basePoints;

  if (profile && !prod.missing) {
    sum += (prod.gamesParticipation01 - NEUTRAL) * MODEL_WEIGHTS.gamesPlayedPoints;
  } else {
    const hist = providers.history.getHistoryTier(input.sleeperPlayerId);
    sum += (hist.tier01 - NEUTRAL) * MODEL_WEIGHTS.curatedHistoryPoints;
  }

  const team = providers.teamOffense.getTeamOffense(input.teamAbbr);
  sum += (team.tier01 - NEUTRAL) * MODEL_WEIGHTS.teamOffensePoints;

  const seasonYear = new Date().getUTCFullYear();
  const oc = providers.coordinator.getOcQuality(input.teamAbbr, seasonYear);
  sum += (oc.tier01 - NEUTRAL) * MODEL_WEIGHTS.ocPoints;

  const role = providers.role.getRoleTier(input.sleeperPlayerId);
  sum += (role.tier01 - NEUTRAL) * MODEL_WEIGHTS.rolePoints;

  const inj = providers.injury.getAvailabilityTier(input.sleeperPlayerId);
  sum += (inj.tier01 - NEUTRAL) * MODEL_WEIGHTS.injuryPoints;

  const ageC = ageCurve01(input.age, input.positionLabel);
  sum += (ageC.tier01 - NEUTRAL) * MODEL_WEIGHTS.agePoints;

  const outlook = futureOutlookRaw({
    age01: ageC.tier01,
    team01: team.tier01,
    role01: role.tier01,
    missingAge: ageC.missing,
    missingTeam: team.missing,
    missingRole: role.missing,
  });
  sum += (outlook.value01 - NEUTRAL) * MODEL_WEIGHTS.futureBlendPoints;

  let leagueFormatAdj = 0;
  const pprTilt = pprReceiverTilt01(league.ppr);
  const sizeTilt = leagueSizeTilt01(league.leagueSize);
  if (isReceiverHeavyPosition(input.positionLabel)) {
    leagueFormatAdj += (pprTilt - NEUTRAL) * MODEL_WEIGHTS.leagueFormatReceiverPoints;
  }
  leagueFormatAdj += (sizeTilt - NEUTRAL) * MODEL_WEIGHTS.leagueFormatSizePoints;
  sum += leagueFormatAdj;

  sum += buzzTweakPoints(input.searchRank, input.trendingAdds);

  const value = Math.round(Math.max(VALUE_MIN, Math.min(VALUE_MAX, applyLeagueFormatToPlayerValue(sum, league, input.positionLabel))));
  return value;
}

function displayName(raw) {
  const f = (raw.first_name ?? "").trim();
  const l = (raw.last_name ?? "").trim();
  return `${f} ${l}`.trim() || "?";
}

async function main() {
  const root = path.join(__dirname, "..");
  const fantasy = JSON.parse(fs.readFileSync(path.join(root, "src/data/trade-model/player-fantasy-profile.json"), "utf8"));
  const curated = JSON.parse(fs.readFileSync(path.join(root, "src/data/trade-model/curated-snapshot.json"), "utf8"));
  const playersMap = await getJson("https://api.sleeper.app/v1/players/nfl");

  const league = { superflex: false, ppr: 1, leagueSize: 12 };
  const anchors = buildFpAnchors(fantasy.profiles, league.ppr);
  const fp = { profiles: fantasy.profiles, anchors };
  const providers = createProviders(curated);

  const rows = [];
  for (const pid of Object.keys(fantasy.profiles)) {
    const raw = playersMap[pid];
    if (!raw || raw.sport !== "nfl" || raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;
    const pos = fantasy.profiles[pid].primaryPosition;
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const v = scorePlayer(
      {
        sleeperPlayerId: pid,
        teamAbbr: team,
        positionLabel: pos,
        searchRank: sr,
        trendingAdds: 0,
        age: resolveAge(raw),
        yearsExp: typeof raw.years_exp === "number" ? raw.years_exp : null,
      },
      providers,
      league,
      fp,
    );
    rows.push({ pid, name: displayName(raw), team, pos, value: v, w: weightedSeasonTotals(fantasy.profiles[pid], 1).weightedPts });
  }

  rows.sort((a, b) => b.value - a.value);
  console.log(JSON.stringify({ league, fantasySnapshot: fantasy.snapshotAsOf, top10ByTradeScore: rows.slice(0, 10) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
