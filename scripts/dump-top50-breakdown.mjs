/**
 * Export top N players by modeled trade value to HTML (default) or CSV — one column per score component.
 *
 * Usage:
 *   node scripts/dump-top50-breakdown.mjs
 *   node scripts/dump-top50-breakdown.mjs --format csv --out output/top50.csv
 *   node scripts/dump-top50-breakdown.mjs --limit 50 --superflex 0 --ppr 1 --league-size 12
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

const HEADER = [
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
    format: "html",
    out: null,
    limit: 50,
    superflex: false,
    ppr: 1,
    leagueSize: 12,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") {
      const f = String(argv[++i] || "").toLowerCase();
      if (f === "csv" || f === "html") out.format = f;
    } else if (a === "--out") out.out = argv[++i];
    else if (a === "--limit") out.limit = Math.max(1, Number(argv[++i]) || 50);
    else if (a === "--superflex") out.superflex = argv[++i] === "1";
    else if (a === "--ppr") {
      const v = argv[++i];
      out.ppr = v === "0" ? 0 : v === "0.5" ? 0.5 : 1;
    } else if (a === "--league-size") {
      const n = Number(argv[++i]);
      if (n === 8 || n === 10 || n === 12 || n === 14) out.leagueSize = n;
    }
  }
  if (!out.out) {
    const base = path.join(__dirname, "..", "output", "top50-player-score-breakdown");
    out.out = out.format === "csv" ? `${base}.csv` : `${base}.html`;
  }
  return out;
}

function csvEscape(s) {
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function buildRowObjects(top, league) {
  let rank = 1;
  const rows = [];
  for (const row of top) {
    const cmap = contributionMap(row.components);
    const miss = missingFlags(row.components);
    const rec = {
      rank: rank++,
      sleeperPlayerId: row.pidStr,
      name: row.name,
      team: row.team,
      position: row.position,
      finalValue: row.value,
      confidence01: row.confidence01.toFixed(4),
      preClampSum: Math.round(row.preClampSum),
      league_superflex: league.superflex ? 1 : 0,
      league_ppr: league.ppr,
      league_size: league.leagueSize,
    };
    for (const k of COMPONENT_KEYS) {
      if (cmap[k] === undefined) rec[k] = "";
      else rec[k] = Math.round(cmap[k] * 100) / 100;
    }
    for (const k of MISSING_KEYS) rec[k] = miss[k] ?? 0;
    rows.push(rec);
  }
  return rows;
}

function writeCsv(outPath, rows) {
  const lines = [HEADER.join(",")];
  for (const rec of rows) {
    const cells = HEADER.map((h) => rec[h]);
    lines.push(cells.map(csvEscape).join(","));
  }
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
}

function writeHtml(outPath, rows, meta) {
  const th = (key) => `<th scope="col">${htmlEscape(key)}</th>`;
  const numericHint = new Set([
    ...COMPONENT_KEYS,
    "finalValue",
    "preClampSum",
    "league_superflex",
    "league_ppr",
    "league_size",
    ...MISSING_KEYS,
  ]);
  const bodyRows = rows
    .map(
      (rec, i) =>
        `<tr class="${i % 2 === 0 ? "even" : "odd"}">${HEADER.map((h) => {
          const v = rec[h];
          const cls = numericHint.has(h) ? "num" : "";
          return `<td class="${cls}">${htmlEscape(v === "" ? "—" : String(v))}</td>`;
        }).join("")}</tr>`,
    )
    .join("\n");

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Top ${rows.length} players — trade score breakdown</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 1rem 1.25rem 2rem; line-height: 1.4; }
    h1 { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.35rem; }
    .meta { font-size: 0.85rem; opacity: 0.85; margin-bottom: 1rem; }
    .wrap { overflow-x: auto; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 8px; }
    table { border-collapse: collapse; font-size: 12px; min-width: max-content; }
    th, td { border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent); padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; background: Canvas; z-index: 1; font-weight: 600; white-space: nowrap; }
    tr.even { background: color-mix(in srgb, Canvas 92%, CanvasText 4%); }
    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.num { text-align: right; }
  </style>
</head>
<body>
  <h1>Top ${rows.length} players — trade score breakdown</h1>
  <div class="meta">
    Generated ${htmlEscape(meta.generatedAt)} ·
    League: PPR=${meta.ppr}, size=${meta.leagueSize}, superflex=${meta.superflex} ·
    Fantasy snapshot: ${htmlEscape(meta.fantasySnapshotAsOf)} ·
    Curated snapshot: ${htmlEscape(meta.curatedSnapshotAsOf)}
  </div>
  <div class="wrap">
    <table>
      <thead><tr>${HEADER.map((h) => (numericHint.has(h) ? `<th scope="col" class="num">${htmlEscape(h)}</th>` : th(h))).join("")}</tr></thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </div>
</body>
</html>
`;
  fs.writeFileSync(outPath, doc, "utf8");
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
  const rows = buildRowObjects(top, league);

  const meta = {
    generatedAt: new Date().toISOString(),
    ppr: league.ppr,
    leagueSize: league.leagueSize,
    superflex: league.superflex,
    fantasySnapshotAsOf: fantasy.snapshotAsOf ?? "—",
    curatedSnapshotAsOf: curated.snapshotAsOf ?? "—",
  };

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  if (opts.format === "csv") writeCsv(opts.out, rows);
  else writeHtml(opts.out, rows, meta);

  console.error(`Wrote ${top.length} rows (${opts.format}) to ${opts.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
