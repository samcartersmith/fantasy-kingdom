/**
 * Build the checked-in player fantasy profile from nflverse regular-season player stats + Sleeper IDs.
 * Run: npm run data:fantasy   (or: node scripts/build-fantasy-profiles-nflverse.mjs)
 *
 * Output: src/data/trade-model/player-fantasy-profile.json (canonical trade-model spine)
 * Join: Sleeper `gsis_id` (trimmed) == nflverse `player_id` (GSIS).
 *
 * Sleeper is used here only for IDs + primary skill position; counting stats and fantasy points come from nflverse.
 * Sleeper market signals (trending, search rank, etc.) are fetched at request time, not from this file.
 *
 * Scoring columns: see docs/nflverse-scoring-parity.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import https from "node:https";
import { nflversePlayerRegStatsUrl } from "./lib/nflverse-player-stats.mjs";
import { buildSleeperGsisSkillIndex, getJson } from "./lib/sleeper-players-http.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL = new Set(["QB", "RB", "WR", "TE"]);

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

function seasonRowFromNflverse(r) {
  const games = typeof r.games === "string" ? Number(r.games) : r.games;
  const gp = typeof games === "number" && Number.isFinite(games) ? games : null;
  if (gp == null || gp <= 0) return null;
  const pts_ppr = Number(r.fantasy_points_ppr);
  const pts_std = Number(r.fantasy_points);
  if (!Number.isFinite(pts_ppr) || !Number.isFinite(pts_std)) return null;
  const pts_half_ppr = (pts_ppr + pts_std) / 2;
  return {
    pts_ppr,
    pts_half_ppr,
    pts_std,
    games: Math.max(1, Math.min(22, Math.round(gp))),
  };
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
    const row = seasonRowFromNflverse(r);
    if (!row) continue;
    byGsis.set(gsis, { pos, row });
  }
  return byGsis;
}

async function main() {
  const seasons = [2023, 2024, 2025];
  const [playersMap, ...byYear] = await Promise.all([
    getJson("https://api.sleeper.app/v1/players/nfl"),
    ...seasons.map((y) => loadSeason(y)),
  ]);

  const { byGsis } = buildSleeperGsisSkillIndex(playersMap);
  const yearMaps = {};
  seasons.forEach((y, i) => {
    yearMaps[String(y)] = byYear[i];
  });

  const profiles = {};
  for (const [gsis, { sleeperId, pos }] of byGsis) {
    const seasonsOut = {};
    for (const y of seasons) {
      const hit = yearMaps[String(y)]?.get(gsis);
      if (!hit) continue;
      seasonsOut[String(y)] = hit.row;
    }
    if (Object.keys(seasonsOut).length === 0) continue;
    profiles[sleeperId] = {
      primaryPosition: pos,
      seasons: seasonsOut,
    };
  }

  const outPath = path.join(__dirname, "..", "src", "data", "trade-model", "player-fantasy-profile.json");
  const payload = {
    snapshotAsOf: new Date().toISOString().slice(0, 10),
    source:
      "nflverse stats_player reg CSV (fantasy_points + fantasy_points_ppr) + Sleeper players/nfl gsis_id for Sleeper player_id + position",
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
