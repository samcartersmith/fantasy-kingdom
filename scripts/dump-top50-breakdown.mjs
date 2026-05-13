/**
 * Export top N players by modeled trade value to CSV with one column per score component.
 *
 * Usage:
 *   node scripts/dump-top50-breakdown.mjs
 *   node scripts/dump-top50-breakdown.mjs --out output/top50.csv --limit 50 --superflex 0 --ppr 1 --league-size 12
 *
 * Requires network for Sleeper players + trending adds (same lookback as trade catalog API).
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

const COMPONENT_KEYS = [
  "fantasyProduction",
  "gamesPlayed",
  "historyCurated",
  "teamOffense",
  "oc",
  "role",
  "availability",
  "age",
  "futureOutlook",
  "leagueFormat",
  "marketBuzz",
  "superflexQb",
];

const MISSING_KEYS = [
  "missing_fantasyProduction",
  "missing_historyCurated",
  "missing_teamOffense",
  "missing_oc",
  "missing_role",
  "missing_availability",
  "missing_age",
  "missing_futureOutlook",
];

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

const SKILL_POSITIONS = ["QB", "RB", "WR", "TE"];
const SKILL_SET = new Set(SKILL_POSITIONS);
const SKILL_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3 };

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

function parseArgs(argv) {
  const out = {
    out: path.join(__dirname, "..", "output", "top50-player-score-breakdown.csv"),
    limit: 50,
    superflex: false,
    ppr: 1,
    leagueSize: 12,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.out = argv[++i];
    else if (a === "--limit") out.limit = Math.max(1, Number(argv[++i]) || 50);
    else if (a === "--superflex") out.superflex = argv[++i] === "1";
    else if (a === "--ppr") {
      const v = argv[++i];
      out.ppr = v === "0" ? 0 : v === "0.5" ? 0.5 : 1;
    }
    else if (a === "--league-size") {
      const n = Number(argv[++i]);
      if (n === 8 || n === 10 || n === 12 || n === 14) out.leagueSize = n;
    }
  }
  return out;
}

function csvEscape(s) {
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function contributionMap(components) {
  const m = {};
  for (const c of components) m[c.key] = c.contribution;
  return m;
}

function missingFlags(components) {
  const keyToCol = {
    fantasyProduction: "missing_fantasyProduction",
    historyCurated: "missing_historyCurated",
    teamOffense: "missing_teamOffense",
    oc: "missing_oc",
    role: "missing_role",
    availability: "missing_availability",
    age: "missing_age",
    futureOutlook: "missing_futureOutlook",
  };
  const out = {};
  for (const k of MISSING_KEYS) out[k] = 0;
  for (const c of components) {
    const col = keyToCol[c.key];
    if (col && c.missing) out[col] = 1;
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv);
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

  const league = { superflex: opts.superflex, ppr: opts.ppr, leagueSize: opts.leagueSize };
  const anchors = buildFpAnchors(fantasy.profiles, league.ppr);
  const fp = { profiles: fantasy.profiles, anchors };
  const providers = createProviders(curated);

  const scored = [];
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
    const detail = scorePlayerDetailed(
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
    scored.push({
      pidStr,
      name: displayName(raw),
      team,
      position,
      ...detail,
    });
  }

  scored.sort((a, b) => b.value - a.value);
  const top = scored.slice(0, opts.limit);

  const header = [
    "rank",
    "sleeperPlayerId",
    "name",
    "team",
    "position",
    "finalValue",
    "confidence01",
    "preClampSum",
    "league_superflex",
    "league_ppr",
    "league_size",
    ...COMPONENT_KEYS,
    ...MISSING_KEYS,
  ];

  const lines = [header.join(",")];
  let rank = 1;
  for (const row of top) {
    const cmap = contributionMap(row.components);
    const miss = missingFlags(row.components);
    const cells = [
      rank++,
      row.pidStr,
      row.name,
      row.team,
      row.position,
      row.value,
      row.confidence01.toFixed(4),
      Math.round(row.preClampSum),
      league.superflex ? 1 : 0,
      league.ppr,
      league.leagueSize,
      ...COMPONENT_KEYS.map((k) => {
        if (cmap[k] === undefined) return "";
        const v = cmap[k];
        return Math.round(v * 100) / 100;
      }),
      ...MISSING_KEYS.map((k) => miss[k] ?? 0),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, lines.join("\n"), "utf8");
  console.error(`Wrote ${top.length} rows to ${opts.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
