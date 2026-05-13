/**
 * Aggregates Sleeper regular-season player stats into a checked-in snapshot for the trade model.
 * Run manually when refreshing data: `node scripts/build-fantasy-profiles.mjs`
 *
 * Sources (read-only, no key):
 * - GET https://api.sleeper.app/v1/players/nfl
 * - GET https://api.sleeper.app/v1/stats/nfl/regular/{season}?season_type=regular&week=18
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const SKILL_ORDER = ["QB", "RB", "WR", "TE"];
const SKILL = new Set(SKILL_ORDER);

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${url} -> ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function primarySkillPosition(raw) {
  const fromFantasy = (raw.fantasy_positions ?? []).map((p) => String(p).trim().toUpperCase());
  for (const want of SKILL_ORDER) {
    if (fromFantasy.includes(want)) return want;
  }
  const base = String(raw.position ?? "")
    .trim()
    .toUpperCase();
  if (SKILL.has(base)) return base;
  return null;
}

function seasonRow(statsObj, pid) {
  const row = statsObj[pid];
  if (!row || typeof row !== "object") return null;
  const gp = typeof row.gp === "number" && Number.isFinite(row.gp) ? row.gp : null;
  if (gp == null || gp <= 0) return null;
  const pts_ppr = typeof row.pts_ppr === "number" && Number.isFinite(row.pts_ppr) ? row.pts_ppr : 0;
  const pts_half_ppr =
    typeof row.pts_half_ppr === "number" && Number.isFinite(row.pts_half_ppr) ? row.pts_half_ppr : 0;
  const pts_std = typeof row.pts_std === "number" && Number.isFinite(row.pts_std) ? row.pts_std : 0;
  return {
    pts_ppr,
    pts_half_ppr,
    pts_std,
    games: Math.max(1, Math.min(22, Math.round(gp))),
  };
}

async function main() {
  const outPath = path.join("src", "data", "trade-model", "player-fantasy-profile.json");
  const [playersMap, stats2023, stats2024] = await Promise.all([
    getJson("https://api.sleeper.app/v1/players/nfl"),
    getJson("https://api.sleeper.app/v1/stats/nfl/regular/2023?season_type=regular&week=18"),
    getJson("https://api.sleeper.app/v1/stats/nfl/regular/2024?season_type=regular&week=18"),
  ]);

  const profiles = {};
  const allPids = new Set([...Object.keys(stats2023), ...Object.keys(stats2024)]);

  for (const pid of allPids) {
    if (!/^\d+$/.test(pid)) continue;
    const raw = playersMap[pid];
    if (!raw || raw.sport !== "nfl") continue;
    const pos = primarySkillPosition(raw);
    if (!pos) continue;

    const s23 = seasonRow(stats2023, pid);
    const s24 = seasonRow(stats2024, pid);
    if (!s23 && !s24) continue;

    const seasons = {};
    if (s23) seasons["2023"] = s23;
    if (s24) seasons["2024"] = s24;

    profiles[pid] = {
      primaryPosition: pos,
      seasons,
    };
  }

  const payload = {
    snapshotAsOf: new Date().toISOString().slice(0, 10),
    source: "Sleeper regular season stats (week 18 rollup) + players/nfl for position",
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
