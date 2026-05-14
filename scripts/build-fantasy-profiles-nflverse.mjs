/**
 * Build the checked-in player fantasy profile from nflverse regular-season player stats + Sleeper IDs.
 * Run: npm run data:fantasy   (or: node scripts/build-fantasy-profiles-nflverse.mjs)
 *
 * Output: src/data/trade-model/player-fantasy-profile.json (canonical trade-model spine)
 * Join: Sleeper `gsis_id` (trimmed) == nflverse `player_id` (GSIS).
 *
 * Sleeper is used only for **Sleeper player ids** and **primary skill position** (and optional `gsis_id` when present).
 * All fantasy points and usage come from nflverse reg-season player CSVs. When Sleeper omits `gsis_id`, we resolve
 * GSIS via nflverse `players.csv` (display_name + latest_team + position ↔ Sleeper search_full_name + team + position).
 * Sleeper market signals (trending, search rank) are fetched at request time, not from this file.
 *
 * Scoring columns: see docs/nflverse-scoring-parity.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import https from "node:https";
import { nflversePlayerRegStatsUrl } from "./lib/nflverse-player-stats.mjs";
import {
  buildSearchKeyToGsisFromNflversePlayersRows,
  resolveGsisForSleeperSkillPlayer,
} from "./lib/sleeper-nflverse-id-bridge.mjs";
import { buildSleeperGsisSkillIndex, getJson, primarySkillPosition } from "./lib/sleeper-players-http.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL = new Set(["QB", "RB", "WR", "TE"]);
const NFLVERSE_PLAYERS_CSV =
  "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

function getText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "text/csv,*/*" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error(`Redirect without location: ${url}`));
            return;
          }
          getText(new URL(loc, url).href).then(resolve).catch(reject);
          return;
        }
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) reject(new Error(`GET ${url} -> ${res.statusCode}`));
          else resolve(body);
        });
      })
      .on("error", reject);
  });
}

function seasonRowFromNflverse(r, posUpper) {
  const games = typeof r.games === "string" ? Number(r.games) : r.games;
  const gp = typeof games === "number" && Number.isFinite(games) ? games : null;
  if (gp == null || gp <= 0) return null;
  const pts_ppr = Number(r.fantasy_points_ppr);
  const pts_std = Number(r.fantasy_points);
  if (!Number.isFinite(pts_ppr) || !Number.isFinite(pts_std)) return null;
  const pts_half_ppr = (pts_ppr + pts_std) / 2;
  const row = {
    pts_ppr,
    pts_half_ppr,
    pts_std,
    games: Math.max(1, Math.min(22, Math.round(gp))),
  };

  const num = (key) => {
    const v = r[key];
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  };

  const targets = num("targets");
  if (targets != null && targets >= 0) row.targets = targets;
  const ts = num("target_share");
  if (ts != null && ts >= 0) row.target_share = Math.min(1.25, ts);
  const carries = num("carries");
  if (carries != null && carries >= 0) row.carries = carries;
  const receptions = num("receptions");
  if (receptions != null && receptions >= 0) row.receptions = receptions;
  if (posUpper === "RB" && row.carries != null && row.targets != null) {
    row.touches = Math.max(0, row.carries + row.targets);
  }
  if (posUpper === "QB") {
    const epa = num("passing_epa");
    if (epa != null) row.passing_epa = epa;
    const py = num("passing_yards");
    const att = num("attempts");
    if (py != null && att != null && att > 0) {
      row.passing_yards = py;
      row.attempts = att;
      row.passing_ypa = py / att;
    }
  }

  return row;
}

async function loadSeason(season) {
  const url = nflversePlayerRegStatsUrl(season, "csv");
  const csv = await getText(url);
  const rows = parse(csv, { columns: true, relax_column_count: true, skip_empty_lines: true });
  const byGsis = new Map();
  for (const r of rows) {
    const pos = String(r.position ?? "").trim().toUpperCase();
    if (!SKILL.has(pos)) continue;
    const st = String(r.season_type ?? "").trim().toUpperCase();
    if (st && st !== "REG") continue;
    const gsis = String(r.player_id ?? "").trim();
    if (!gsis) continue;
    const row = seasonRowFromNflverse(r, pos);
    if (!row) continue;
    byGsis.set(gsis, { pos, row });
  }
  return byGsis;
}

async function main() {
  const seasons = [2023, 2024, 2025];
  const [playersMap, playersCsvText, ...byYear] = await Promise.all([
    getJson("https://api.sleeper.app/v1/players/nfl"),
    getText(NFLVERSE_PLAYERS_CSV),
    ...seasons.map((y) => loadSeason(y)),
  ]);

  const playerMasterRows = parse(playersCsvText, {
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  });
  const searchKeyToGsis = buildSearchKeyToGsisFromNflversePlayersRows(playerMasterRows);

  const { byGsis } = buildSleeperGsisSkillIndex(playersMap);
  const yearMaps = {};
  seasons.forEach((y, i) => {
    yearMaps[String(y)] = byYear[i];
  });

  const profiles = {};

  function addProfile(sleeperId, pos, gsis) {
    if (profiles[sleeperId]) return;
    const seasonsOut = {};
    for (const y of seasons) {
      const hit = yearMaps[String(y)]?.get(gsis);
      if (!hit) continue;
      seasonsOut[String(y)] = hit.row;
    }
    if (Object.keys(seasonsOut).length === 0) return;
    profiles[sleeperId] = {
      primaryPosition: pos,
      seasons: seasonsOut,
    };
  }

  for (const [gsis, { sleeperId, pos }] of byGsis) {
    addProfile(sleeperId, pos, gsis);
  }

  for (const [entryKey, raw] of Object.entries(playersMap)) {
    const sleeperId = String(raw?.player_id ?? entryKey);
    if (profiles[sleeperId]) continue;
    if (!raw || raw.sport !== "nfl") continue;
    const pos = primarySkillPosition(raw);
    if (!pos) continue;
    const gsis = resolveGsisForSleeperSkillPlayer(raw, searchKeyToGsis);
    if (!gsis) continue;
    addProfile(sleeperId, pos, gsis);
  }

  const outPath = path.join(__dirname, "..", "src", "data", "trade-model", "player-fantasy-profile.json");
  const payload = {
    snapshotAsOf: new Date().toISOString().slice(0, 10),
    source:
      "nflverse stats_player reg CSV (PPR/half/std fantasy points + usage) keyed by GSIS; nflverse players.csv + Sleeper players/nfl for Sleeper player_id + position (GSIS from Sleeper gsis_id or name/team/pos bridge when gsis_id is null)",
    profiles,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(`Wrote ${Object.keys(profiles).length} profiles to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
