/**
 * Compare modeled trade scores to a frozen reference board.
 *
 * Legacy CSV (comma): columns rank, player_name, reference_value — match by normalized display name.
 * FantasyCalc-style export (semicolon): includes sleeperId and value — match by Sleeper player id.
 *
 * Run: node scripts/calibrate-vs-reference.mjs
 * Optional: node scripts/calibrate-vs-reference.mjs --reference path/to.csv
 * Optional: node scripts/calibrate-vs-reference.mjs --format auto|legacy|fantasycalc
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import {
  buildFpAnchors,
  createProviders,
  displayName,
  loadRepoJson,
  resolveAge,
  scorePlayerDetailed,
} from "./trade-score-dump-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKILL_POSITIONS = ["QB", "RB", "WR", "TE"];
const SKILL_SET = new Set(SKILL_POSITIONS);
const SKILL_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3 };

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

function getSkillFantasyPositions(raw) {
  const found = new Set();
  for (const p of raw.fantasy_positions ?? []) {
    const u = String(p ?? "")
      .trim()
      .toUpperCase();
    if (SKILL_SET.has(u)) found.add(u);
  }
  const base = String(raw.position ?? "")
    .trim()
    .toUpperCase();
  if (SKILL_SET.has(base)) found.add(base);
  return Array.from(found).sort((a, b) => SKILL_ORDER[a] - SKILL_ORDER[b]);
}

function skillPositionsDisplay(positions) {
  return positions.join(",");
}

function normName(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupByRefName(byNormName, refName) {
  const n = normName(refName);
  if (byNormName.has(n)) return byNormName.get(n);
  const stripped = n.replace(/\s+(iii|ii|iv|jr|sr)\s*$/i, "").trim();
  if (byNormName.has(stripped)) return byNormName.get(stripped);
  return undefined;
}

function parseReferenceCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const idxRank = header.indexOf("rank");
  const idxName = header.indexOf("player_name");
  const idxVal = header.indexOf("reference_value");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 3) continue;
    rows.push({
      rank: Number(parts[idxRank]),
      player_name: parts[idxName],
      reference_value: Number(parts[idxVal]),
    });
  }
  return rows;
}

/** FantasyCalc dynasty export: `;` delimiter, sleeperId + value. */
function parseFantasyCalcCsv(text) {
  const rows = parse(text, {
    columns: true,
    delimiter: ";",
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
  const out = [];
  for (const row of rows) {
    const keys = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), v]),
    );
    const sid = keys.sleeperid ?? keys.sleeper_id;
    const val = keys.value;
    if (sid == null || String(sid).trim() === "" || val === undefined || val === "") continue;
    const reference_value = Number(String(val).replace(",", "."));
    if (!Number.isFinite(reference_value)) continue;
    const rankRaw = keys.overallrank ?? keys.overall_rank ?? keys.rank;
    const rank = rankRaw != null && String(rankRaw).trim() !== "" ? Number(rankRaw) : null;
    const trendRaw = keys.trend30day ?? keys.trend_30day;
    const trend30day =
      trendRaw != null && String(trendRaw).trim() !== "" ? Number(String(trendRaw).replace(",", ".")) : null;
    out.push({
      sleeper_id: String(sid).trim(),
      reference_value,
      reference_rank: rank != null && Number.isFinite(rank) ? rank : null,
      trend30day: trend30day != null && Number.isFinite(trend30day) ? trend30day : null,
    });
  }
  return out;
}

function detectReferenceFormat(text) {
  const first = (text.trim().split(/\r?\n/)[0] ?? "").toLowerCase();
  if (first.includes(";") && first.includes("sleeperid")) return "fantasycalc";
  return "legacy";
}

function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (arr) => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const r = new Array(n);
    let t = 0;
    while (t < n) {
      let u = t;
      while (u + 1 < n && indexed[u + 1].v === indexed[t].v) u++;
      const avg = (t + u + 2) / 2;
      for (let k = t; k <= u; k++) r[indexed[k].i] = avg;
      t = u + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) {
    const ax = rx[i] - mx;
    const ay = ry[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx;
    const ay = ys[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** PAV isotonic regression: non-decreasing fitted values along sorted-x index order. */
function isotonicNonDecreasingFit(sortedY) {
  let blocks = sortedY.map((v) => ({ sum: v, cnt: 1 }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i];
      const b = blocks[i + 1];
      if (a.sum / a.cnt > b.sum / b.cnt) {
        blocks = blocks.slice(0, i).concat([{ sum: a.sum + b.sum, cnt: a.cnt + b.cnt }], blocks.slice(i + 2));
        merged = true;
        break;
      }
    }
  }
  const fitted = [];
  for (const b of blocks) {
    const m = b.sum / b.cnt;
    for (let k = 0; k < b.cnt; k++) fitted.push(m);
  }
  return fitted;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function rmse(actual, pred) {
  if (actual.length === 0) return null;
  let s = 0;
  for (let i = 0; i < actual.length; i++) {
    const d = actual[i] - pred[i];
    s += d * d;
  }
  return Math.sqrt(s / actual.length);
}

function argvFlagValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

async function main() {
  const refPath =
    process.argv.includes("--reference") && process.argv[process.argv.indexOf("--reference") + 1]
      ? process.argv[process.argv.indexOf("--reference") + 1]
      : path.join(__dirname, "..", "src/data/trade-model/calibration-reference-board.csv");

  const formatArg = argvFlagValue("--format");
  const refText = fs.readFileSync(refPath, "utf8");
  const detected = detectReferenceFormat(refText);
  const format =
    formatArg === "legacy" || formatArg === "fantasycalc" ? formatArg : formatArg === "auto" ? detected : detected;

  const refRows = format === "fantasycalc" ? parseFantasyCalcCsv(refText) : parseReferenceCsv(refText);

  const fantasy = loadRepoJson("src/data/trade-model/player-fantasy-profile.json");
  const curated = loadRepoJson("src/data/trade-model/curated-snapshot.json");
  const [playersMap, trendingRows] = await Promise.all([
    getJson("https://api.sleeper.app/v1/players/nfl"),
    getJson("https://api.sleeper.app/v1/players/nfl/trending/add?limit=120&lookback_hours=72"),
  ]);

  const trendingAdds = new Map();
  if (Array.isArray(trendingRows)) {
    for (const r of trendingRows) {
      if (r?.player_id && typeof r.count === "number") trendingAdds.set(String(r.player_id), r.count);
    }
  }

  const league = { superflex: false, ppr: 1, leagueSize: 12 };
  const anchors = buildFpAnchors(fantasy.profiles, league.ppr);
  const fp = { profiles: fantasy.profiles, anchors };
  const providers = createProviders(curated);

  const byNormName = new Map();
  const bySleeperId = new Map();
  for (const [key, raw] of Object.entries(playersMap)) {
    if (!raw || typeof raw !== "object") continue;
    const pid = raw.player_id ?? key;
    if (!/^\d+$/.test(String(pid))) continue;
    if (raw.sport && raw.sport !== "nfl") continue;
    if (raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;
    const skills = getSkillFantasyPositions(raw);
    if (skills.length === 0) continue;
    const pidStr = String(pid);
    const position = skillPositionsDisplay(skills);
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const ta = trendingAdds.get(pidStr) ?? 0;
    const scored = scorePlayerDetailed(
      {
        sleeperPlayerId: pidStr,
        teamAbbr: team,
        positionLabel: position,
        searchRank: sr,
        trendingAdds: ta,
        age: resolveAge(raw),
        yearsExp: typeof raw.years_exp === "number" && Number.isFinite(raw.years_exp) ? raw.years_exp : null,
      },
      providers,
      league,
      fp,
    );
    const rec = { pidStr, name: displayName(raw), modelValue: scored.value };
    bySleeperId.set(pidStr, rec);
    const nm = normName(displayName(raw));
    if (!byNormName.has(nm)) byNormName.set(nm, rec);
  }

  const matched = [];
  const missing = [];

  if (format === "fantasycalc") {
    for (const r of refRows) {
      const hit = bySleeperId.get(r.sleeper_id);
      if (!hit) {
        missing.push(r.sleeper_id);
        continue;
      }
      matched.push({
        reference_rank: r.reference_rank,
        name: hit.name,
        reference_value: r.reference_value,
        model_value: hit.modelValue,
        sleeperPlayerId: hit.pidStr,
        delta: hit.modelValue - r.reference_value,
        trend30day: r.trend30day,
      });
    }
  } else {
    for (const r of refRows) {
      const hit = lookupByRefName(byNormName, r.player_name);
      if (!hit) {
        missing.push(r.player_name);
        continue;
      }
      matched.push({
        reference_rank: r.rank,
        name: r.player_name,
        reference_value: r.reference_value,
        model_value: hit.modelValue,
        sleeperPlayerId: hit.pidStr,
        delta: hit.modelValue - r.reference_value,
      });
    }
  }

  const refVals = matched.map((m) => m.reference_value);
  const modelVals = matched.map((m) => m.model_value);
  const rho = spearman(refVals, modelVals);
  const pearsonRefModel = pearson(modelVals, refVals);

  const sortedIdx = matched.map((_, i) => i).sort((a, b) => modelVals[a] - modelVals[b]);
  const refAlongModel = sortedIdx.map((i) => refVals[i]);
  const isoFitted = isotonicNonDecreasingFit(refAlongModel);
  const refAlongModelRmse = rmse(refAlongModel, isoFitted);
  const spearmanModelVsIso = spearman(
    sortedIdx.map((i) => modelVals[i]),
    isoFitted,
  );

  const meanAbsDelta = matched.length ? mean(matched.map((m) => Math.abs(m.delta))) : null;

  const ols =
    matched.length >= 3
      ? (() => {
          const n = modelVals.length;
          const mx = mean(modelVals);
          const my = mean(refVals);
          let num = 0;
          let den = 0;
          for (let i = 0; i < n; i++) {
            const dx = modelVals[i] - mx;
            num += dx * (refVals[i] - my);
            den += dx * dx;
          }
          const b = den === 0 ? 0 : num / den;
          const a = my - b * mx;
          let sse = 0;
          for (let i = 0; i < n; i++) {
            const e = refVals[i] - (a + b * modelVals[i]);
            sse += e * e;
          }
          return { intercept: a, slope: b, rmseRefVsLinearModel: Math.sqrt(sse / n) };
        })()
      : null;

  console.log(
    JSON.stringify(
      {
        referenceFile: refPath,
        referenceFormat: format,
        referenceRowCount: refRows.length,
        matchedCount: matched.length,
        missingKeys: format === "fantasycalc" ? missing.slice(0, 40) : undefined,
        missingNames: format === "legacy" ? missing : undefined,
        missingCount: missing.length,
        spearmanReferenceVsModel: rho,
        pearsonModelVsReference: pearsonRefModel,
        meanAbsModelMinusReference: meanAbsDelta,
        linearRegressionReferenceOnModel: ols,
        monotoneAlongModelOrder: {
          description:
            "Isotonic (non-decreasing) fit to reference values in model-value sort order — best monotone proxy of FC value vs our ordering.",
          rmseReferenceVsIsotonicFit: refAlongModelRmse,
          spearmanModelVsIsotonicFittedReference: spearmanModelVsIso,
        },
        sample: matched.slice(0, 12),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
