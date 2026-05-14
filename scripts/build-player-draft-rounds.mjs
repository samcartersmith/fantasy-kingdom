/**
 * Map nflverse `players.csv` draft_round → Sleeper `player_id` for skill positions.
 * Run: npm run data:draft-rounds   (or: node scripts/build-player-draft-rounds.mjs)
 *
 * Output: src/data/trade-model/player-nfl-draft-round.json (flat { [sleeperPlayerId]: round })
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import https from "node:https";
import {
  buildSearchKeyToGsisFromNflversePlayersRows,
  resolveGsisForSleeperSkillPlayer,
} from "./lib/sleeper-nflverse-id-bridge.mjs";
import { buildSleeperGsisSkillIndex, getJson, primarySkillPosition } from "./lib/sleeper-players-http.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLAYERS_CSV =
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

async function main() {
  const [csvText, playersMap] = await Promise.all([getText(PLAYERS_CSV), getJson("https://api.sleeper.app/v1/players/nfl")]);

  const rows = parse(csvText, { columns: true, relax_column_count: true, skip_empty_lines: true });
  const searchKeyToGsis = buildSearchKeyToGsisFromNflversePlayersRows(rows);

  const draftByGsis = new Map();
  for (const r of rows) {
    const gsis = String(r.gsis_id ?? "").trim();
    if (!gsis) continue;
    const dr = Number(r.draft_round);
    if (!Number.isFinite(dr) || dr < 1) continue;
    draftByGsis.set(gsis, Math.min(7, Math.floor(dr)));
  }

  const { byGsis } = buildSleeperGsisSkillIndex(playersMap);
  const out = {};

  function addIfDraft(gsis, sleeperId) {
    const dr = draftByGsis.get(gsis);
    if (dr != null) out[sleeperId] = dr;
  }

  for (const [gsis, { sleeperId }] of byGsis) {
    addIfDraft(gsis, sleeperId);
  }

  for (const [entryKey, raw] of Object.entries(playersMap)) {
    const sleeperId = String(raw?.player_id ?? entryKey);
    if (out[sleeperId]) continue;
    if (!raw || raw.sport !== "nfl") continue;
    if (!primarySkillPosition(raw)) continue;
    const gsis = resolveGsisForSleeperSkillPlayer(raw, searchKeyToGsis);
    if (!gsis) continue;
    addIfDraft(gsis, sleeperId);
  }

  const outPath = path.join(__dirname, "..", "src", "data", "trade-model", "player-nfl-draft-round.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 0));
  console.log(`Wrote ${Object.keys(out).length} draft round entries to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
