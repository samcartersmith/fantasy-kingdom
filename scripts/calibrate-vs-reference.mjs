/**
 * Compare modeled trade scores to a frozen reference board (CSV by player name).
 * Loads the same JSON + Sleeper data as the trade catalog, scores all skill players,
 * matches reference rows by normalized display name, prints deltas and a simple rank correlation.
 *
 * Run: node scripts/calibrate-vs-reference.mjs
 * Optional: node scripts/calibrate-vs-reference.mjs --reference path/to.csv
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

async function main() {
  const refPath =
    process.argv.includes("--reference") && process.argv[process.argv.indexOf("--reference") + 1]
      ? process.argv[process.argv.indexOf("--reference") + 1]
      : path.join(__dirname, "..", "src/data/trade-model/calibration-reference-board.csv");

  const refText = fs.readFileSync(refPath, "utf8");
  const refRows = parseReferenceCsv(refText);

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
    const nm = normName(displayName(raw));
    if (!byNormName.has(nm)) byNormName.set(nm, { pidStr, name: displayName(raw), modelValue: scored.value });
  }

  const matched = [];
  const missing = [];
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

  const xs = matched.map((m) => m.reference_value);
  const ys = matched.map((m) => m.model_value);
  const rho = spearman(xs, ys);

  console.log(
    JSON.stringify(
      {
        referenceFile: refPath,
        matchedCount: matched.length,
        missingNames: missing,
        spearmanReferenceVsModel: rho,
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
