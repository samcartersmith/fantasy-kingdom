/**
 * Join coverage spike: Sleeper skill players (GSIS) vs nflverse regular-season player stats.
 * Run: node scripts/nflverse-join-coverage-spike.mjs
 *
 * Requires network. Prints JSON to stdout.
 */
import { parse } from "csv-parse/sync";
import https from "node:https";
import { nflversePlayerRegStatsUrl } from "./lib/nflverse-player-stats.mjs";
import { buildSleeperGsisSkillIndex, getJson } from "./lib/sleeper-players-http.mjs";

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

function loadNflverseSkillRows(season) {
  const url = nflversePlayerRegStatsUrl(season, "csv");
  return getText(url).then((csv) => {
    const rows = parse(csv, { columns: true, relax_column_count: true, skip_empty_lines: true });
    const out = [];
    for (const r of rows) {
      const pos = String(r.position ?? "").trim().toUpperCase();
      if (!SKILL.has(pos)) continue;
      const st = String(r.season_type ?? "").trim().toUpperCase();
      if (st && st !== "REG") continue;
      const pid = String(r.player_id ?? "").trim();
      if (!pid) continue;
      out.push({ player_id: pid, season: Number(r.season), position: pos });
    }
    return out;
  });
}

async function main() {
  const playersMap = await getJson("https://api.sleeper.app/v1/players/nfl");
  const { byGsis } = buildSleeperGsisSkillIndex(playersMap);

  let skillSleeper = 0;
  for (const [, raw] of Object.entries(playersMap)) {
    if (!raw || raw.sport !== "nfl") continue;
    const fp = (raw.fantasy_positions ?? []).map((p) => String(p).trim().toUpperCase());
    if (!fp.some((p) => SKILL.has(p))) continue;
    skillSleeper += 1;
  }

  const seasons = [2023, 2024, 2025];
  const nflBySeason = {};
  const nflSkillGsis = new Set();
  for (const y of seasons) {
    const rows = await loadNflverseSkillRows(y);
    nflBySeason[String(y)] = rows.length;
    for (const r of rows) nflSkillGsis.add(r.player_id);
  }

  const sleeperSkillWithGsis = byGsis.size;
  let matchedInNflverse = 0;
  for (const gsis of byGsis.keys()) {
    if (nflSkillGsis.has(gsis)) matchedInNflverse += 1;
  }

  const report = {
    snapshotNote: "Sleeper skill = fantasy_positions intersects QB/RB/WR/TE; join key = trim(gsis_id) == nflverse player_id (GSIS).",
    sleeperSkillPlayers: skillSleeper,
    sleeperSkillWithGsis: sleeperSkillWithGsis,
    nflverseSkillUniqueGsisAcrossSeasons: nflSkillGsis.size,
    nflverseRegSkillRowCountsBySeason: nflBySeason,
    sleeperSkillWithGsisMatchedInNflverse: matchedInNflverse,
    matchRateSleeperGsisInNflverse:
      sleeperSkillWithGsis > 0 ? Number((matchedInNflverse / sleeperSkillWithGsis).toFixed(4)) : null,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
