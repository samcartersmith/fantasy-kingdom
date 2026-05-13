/**
 * Expand curated-snapshot.json: fill ocQuality01 for all NFL teams (current UTC year)
 * and playerRole01 from Sleeper search_rank buckets for active skill players.
 *
 * Run: node scripts/hydrate-curated-from-sleeper.mjs
 * Requires network.
 */
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
];

const SKILL = new Set(["QB", "RB", "WR", "TE"]);

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

function hasSkillPosition(raw) {
  for (const p of raw.fantasy_positions ?? []) {
    if (SKILL.has(String(p ?? "").trim().toUpperCase())) return true;
  }
  return SKILL.has(String(raw.position ?? "").trim().toUpperCase());
}

function roleFromSearchRank(sr) {
  if (sr == null || !Number.isFinite(sr) || sr <= 0 || sr > 2500) return 0.48;
  if (sr <= 35) return 0.88;
  if (sr <= 90) return 0.8;
  if (sr <= 180) return 0.72;
  if (sr <= 400) return 0.62;
  if (sr <= 800) return 0.55;
  return 0.5;
}

async function main() {
  const root = path.join(__dirname, "..");
  const snapPath = path.join(root, "src/data/trade-model/curated-snapshot.json");
  const snapshot = JSON.parse(fs.readFileSync(snapPath, "utf8"));
  const year = new Date().getUTCFullYear();

  if (!snapshot.ocQuality01) snapshot.ocQuality01 = {};
  for (const abbr of NFL_TEAMS) {
    const k = `${abbr}:${year}`;
    if (snapshot.ocQuality01[k] == null) {
      const off = snapshot.teamOffense01?.[abbr];
      snapshot.ocQuality01[k] = typeof off === "number" && Number.isFinite(off) ? off : 0.55;
    }
  }

  const playersMap = await getJson("https://api.sleeper.app/v1/players/nfl");
  if (!snapshot.playerRole01) snapshot.playerRole01 = {};
  const roles = { ...snapshot.playerRole01 };

  for (const [key, raw] of Object.entries(playersMap)) {
    if (!raw || typeof raw !== "object") continue;
    const pid = String(raw.player_id ?? key);
    if (!/^\d+$/.test(pid)) continue;
    if (raw.sport && raw.sport !== "nfl") continue;
    if (raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;
    if (!hasSkillPosition(raw)) continue;
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    roles[pid] = roleFromSearchRank(sr);
  }

  snapshot.playerRole01 = roles;
  snapshot.snapshotAsOf = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(snapPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.error(`Updated ${snapPath} (oc keys for ${year}, playerRole01: ${Object.keys(roles).length} ids)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
