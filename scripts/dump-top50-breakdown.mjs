/**
 * Export top N players by modeled trade value to HTML (default) or CSV — one column per score component.
 * By default also writes a sibling `*-extended.*` file: same component columns plus FP spine (weighted pts,
 * per-season pts/games, norms) and raw Sleeper inputs (search rank, trending adds, age) for tuning / planning.
 *
 * Usage:
 *   node scripts/dump-top50-breakdown.mjs
 *   node scripts/dump-top50-breakdown.mjs --format csv --out output/top50.csv
 *   node scripts/dump-top50-breakdown.mjs --limit 50 --superflex 0 --ppr 1 --league-size 12
 *   node scripts/dump-top50-breakdown.mjs --no-extended
 *
 * Requires network for Sleeper players + trending adds (same lookback as trade catalog API).
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFpAnchors,
  buildRichStatAnchors,
  computeVbdComputation,
  createProviders,
  DEFAULT_STARTING_SLOTS,
  displayName,
  loadRepoJson,
  productionBaseTradePoints,
  resolveAge,
  scorePlayerDetailed,
  weightedPpg,
  weightedSeasonTotals,
} from "./trade-score-dump-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPONENT_KEYS = [
  "fantasyProduction",
  "vbdDynasty",
  "draftCapital",
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
  "missing_vbdDynasty",
  "missing_draftCapital",
  "missing_historyCurated",
  "missing_teamOffense",
  "missing_oc",
  "missing_role",
  "missing_availability",
  "missing_age",
  "missing_futureOutlook",
];

/** Same season window as `trade-score-dump-shared.mjs` / `fp-baseline.ts` (newest first). */
const FP_SEASON_KEYS = ["2025", "2024", "2023"];

const EXTENDED_KEYS = [
  "input_search_rank",
  "input_trending_adds_72h",
  "input_age_years",
  "input_years_exp",
  "fp_weighted_pts_ppr",
  "fp_seasons_used",
  "fp_wppg",
  "fp_games_weight",
  "fp_combined_norm01",
  "fp_games_participation01",
  "fp_missing",
  "fp_pts_2025",
  "fp_gp_2025",
  "fp_pts_2024",
  "fp_gp_2024",
  "fp_pts_2023",
  "fp_gp_2023",
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

const EXTENDED_HEADER = [...HEADER, ...EXTENDED_KEYS];

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
    /** When true, also writes `*-extended.{csv,html}` with FP + Sleeper inputs alongside component columns. */
    extended: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") {
      const f = String(argv[++i] || "").toLowerCase();
      if (f === "csv" || f === "html") out.format = f;
    } else if (a === "--out") out.out = argv[++i];
    else if (a === "--no-extended") out.extended = false;
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
    vbdDynasty: "missing_vbdDynasty",
    draftCapital: "missing_draftCapital",
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

function fpSeasonPtsGames(profile, ppr, year) {
  if (!profile?.seasons?.[year]) return { pts: "", gp: "" };
  const r = profile.seasons[year];
  const pts =
    ppr >= 1 ? r.pts_ppr : ppr >= 0.5 ? r.pts_half_ppr : r.pts_std;
  const gp = r.games ?? "";
  return { pts: Number.isFinite(pts) ? Math.round(pts * 100) / 100 : "", gp };
}

function buildExtendedRowObjects(top, league, fp) {
  const base = buildRowObjects(top, league);
  const out = [];
  for (let i = 0; i < top.length; i++) {
    const row = top[i];
    const rec = { ...base[i] };
    const raw = row.sleeperRaw;
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : "";
    const ta = row.trendingAdds72h ?? 0;
    const age = resolveAge(raw);
    const yexp =
      typeof raw.years_exp === "number" && Number.isFinite(raw.years_exp) ? raw.years_exp : "";

    const profile = fp.profiles[row.pidStr];
    const wst = profile ? weightedSeasonTotals(profile, league.ppr) : { weightedPts: 0, seasonsUsed: 0 };
    const wpg = profile ? weightedPpg(profile, league.ppr) : { wppg: 0, gamesWeight: 0 };
    const prod = productionBaseTradePoints(profile, fp, league.ppr);

    rec.input_search_rank = sr === "" ? "" : sr;
    rec.input_trending_adds_72h = ta;
    rec.input_age_years = age == null ? "" : age;
    rec.input_years_exp = yexp;
    rec.fp_weighted_pts_ppr = Math.round(wst.weightedPts * 100) / 100;
    rec.fp_seasons_used = wst.seasonsUsed;
    rec.fp_wppg = Math.round(wpg.wppg * 1000) / 1000;
    rec.fp_games_weight = Math.round(wpg.gamesWeight * 100) / 100;
    rec.fp_combined_norm01 = Math.round(prod.combinedNorm01 * 10000) / 10000;
    rec.fp_games_participation01 = Math.round(prod.gamesParticipation01 * 10000) / 10000;
    rec.fp_missing = prod.missing ? 1 : 0;

    for (const y of FP_SEASON_KEYS) {
      const { pts, gp } = fpSeasonPtsGames(profile, league.ppr, y);
      rec[`fp_pts_${y}`] = pts;
      rec[`fp_gp_${y}`] = gp;
    }
    out.push(rec);
  }
  return out;
}

function writeCsv(outPath, rows, header = HEADER) {
  const lines = [header.join(",")];
  for (const rec of rows) {
    const cells = header.map((h) => rec[h]);
    lines.push(cells.map(csvEscape).join(","));
  }
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
}

function writeHtml(outPath, rows, meta, header = HEADER) {
  const th = (key) => `<th scope="col">${htmlEscape(key)}</th>`;
  const numericHint = new Set([
    ...COMPONENT_KEYS,
    ...EXTENDED_KEYS,
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
        `<tr class="${i % 2 === 0 ? "even" : "odd"}">${header.map((h) => {
          const v = rec[h];
          const cls = numericHint.has(h) ? "num" : "";
          return `<td class="${cls}">${htmlEscape(v === "" ? "—" : String(v))}</td>`;
        }).join("")}</tr>`,
    )
    .join("\n");

  const titleSuffix = header.length > HEADER.length ? " (with FP + input columns)" : "";
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Top ${rows.length} players — trade score breakdown${titleSuffix}</title>
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
  <h1>Top ${rows.length} players — trade score breakdown${titleSuffix}</h1>
  <div class="meta">
    Generated ${htmlEscape(meta.generatedAt)} ·
    League: PPR=${meta.ppr}, size=${meta.leagueSize}, superflex=${meta.superflex} ·
    Fantasy snapshot: ${htmlEscape(meta.fantasySnapshotAsOf)} ·
    Curated snapshot: ${htmlEscape(meta.curatedSnapshotAsOf)}
  </div>
  <div class="wrap">
    <table>
      <thead><tr>${header.map((h) => (numericHint.has(h) ? `<th scope="col" class="num">${htmlEscape(h)}</th>` : th(h))).join("")}</tr></thead>
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

  const draftRounds = loadRepoJson("src/data/trade-model/player-nfl-draft-round.json");

  const league = { ...DEFAULT_STARTING_SLOTS, superflex: opts.superflex, ppr: opts.ppr, leagueSize: opts.leagueSize };
  const anchors = buildFpAnchors(fantasy.profiles, league.ppr);
  const richAnchors = buildRichStatAnchors(fantasy.profiles, league.ppr);
  const vbd = computeVbdComputation(fantasy.profiles, league.ppr, league);
  const fp = {
    profiles: fantasy.profiles,
    anchors,
    richAnchors,
    vbdBySleeperId: vbd.bySleeperId,
    vbdScale: vbd.scale,
  };
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
        nflDraftRound:
          typeof draftRounds[pidStr] === "number" && Number.isFinite(draftRounds[pidStr]) ? draftRounds[pidStr] : null,
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
      sleeperRaw: raw,
      trendingAdds72h: ta,
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
  if (opts.format === "csv") writeCsv(opts.out, rows, HEADER);
  else writeHtml(opts.out, rows, meta, HEADER);

  console.error(`Wrote ${top.length} rows (${opts.format}) to ${opts.out}`);

  if (opts.extended) {
    const extRows = buildExtendedRowObjects(top, league, fp);
    const extPath = opts.out.replace(/\.(csv|html)$/i, "-extended.$1");
    if (opts.format === "csv") writeCsv(extPath, extRows, EXTENDED_HEADER);
    else writeHtml(extPath, extRows, meta, EXTENDED_HEADER);
    console.error(`Wrote ${top.length} extended rows (${opts.format}) to ${extPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
