/**
 * Rank players in the local fantasy snapshot by full trade model score.
 * Uses real Sleeper player rows for team / age / search_rank; trending adds = 0.
 *
 * Run: node scripts/dump-top-trade-scores.mjs
 */
import https from "node:https";
import {
  buildFpAnchors,
  buildRichStatAnchors,
  computeVbdComputation,
  createProviders,
  DEFAULT_STARTING_SLOTS,
  displayName,
  loadRepoJson,
  resolveAge,
  scorePlayerDetailed,
  weightedSeasonTotals,
} from "./trade-score-dump-shared.mjs";

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

async function main() {
  const fantasy = loadRepoJson("src/data/trade-model/player-fantasy-profile.json");
  const curated = loadRepoJson("src/data/trade-model/curated-snapshot.json");
  const playersMap = await getJson("https://api.sleeper.app/v1/players/nfl");

  const draftRounds = loadRepoJson("src/data/trade-model/player-nfl-draft-round.json");

  const league = { ...DEFAULT_STARTING_SLOTS, superflex: false, ppr: 1, leagueSize: 12 };
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

  const rows = [];
  for (const pid of Object.keys(fantasy.profiles)) {
    const raw = playersMap[pid];
    if (!raw || raw.sport !== "nfl" || raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;
    const skills = getSkillFantasyPositions(raw);
    if (skills.length === 0) continue;
    const pos = fantasy.profiles[pid].primaryPosition;
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const scored = scorePlayerDetailed(
      {
        sleeperPlayerId: pid,
        teamAbbr: team,
        positionLabel: pos,
        searchRank: sr,
        trendingAdds: 0,
        age: resolveAge(raw),
        yearsExp: typeof raw.years_exp === "number" ? raw.years_exp : null,
        nflDraftRound: typeof draftRounds[pid] === "number" && Number.isFinite(draftRounds[pid]) ? draftRounds[pid] : null,
      },
      providers,
      league,
      fp,
    );
    rows.push({
      pid,
      name: displayName(raw),
      team,
      pos,
      value: scored.value,
      w: weightedSeasonTotals(fantasy.profiles[pid], 1).weightedPts,
    });
  }

  rows.sort((a, b) => b.value - a.value);
  console.log(JSON.stringify({ league, fantasySnapshot: fantasy.snapshotAsOf, top10ByTradeScore: rows.slice(0, 10) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
