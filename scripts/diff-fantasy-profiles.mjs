/**
 * Compare trade scores using two fantasy profile JSON files (default: canonical nflverse vs optional Sleeper rollup).
 * Uses the same Sleeper catalog rows (Active + NFL team) and curated snapshot as production dumps.
 *
 * Run:
 *   npm run data:fantasy:sleeper   # ensure player-fantasy-profile.sleeper.json exists
 *   node scripts/diff-fantasy-profiles.mjs
 *   node scripts/diff-fantasy-profiles.mjs --baseline src/data/trade-model/player-fantasy-profile.json --candidate src/data/trade-model/player-fantasy-profile.sleeper.json
 *
 * Reference league: full PPR, 12 teams, non-superflex (matches plan acceptance gates).
 */
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFpAnchors,
  buildRichStatAnchors,
  computeVbdComputation,
  createProviders,
  DEFAULT_STARTING_SLOTS,
  loadRepoJson,
  productionBaseTradePoints,
  resolveAge,
  scorePlayerDetailed,
} from "./trade-score-dump-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function parseArgs(argv) {
  let baseline = "src/data/trade-model/player-fantasy-profile.json";
  let candidate = "src/data/trade-model/player-fantasy-profile.sleeper.json";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--baseline" && argv[i + 1]) {
      baseline = argv[i + 1];
      i++;
    } else if (argv[i] === "--candidate" && argv[i + 1]) {
      candidate = argv[i + 1];
      i++;
    }
  }
  return { baseline, candidate };
}

function loadJsonFromRoot(rel) {
  const root = path.join(__dirname, "..");
  const p = path.isAbsolute(rel) ? rel : path.join(root, rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function rankPlayers(ids, scores) {
  const sorted = [...ids].sort((a, b) => (scores.get(b) ?? -1) - (scores.get(a) ?? -1));
  const rank = new Map();
  sorted.forEach((id, i) => rank.set(id, i + 1));
  return rank;
}

function evaluateGates(baseRank, candRank, ids, baseMissing, candMissing) {
  const n = ids.length;
  const missBase = ids.filter((id) => baseMissing.get(id)).length;
  const missCand = ids.filter((id) => candMissing.get(id)).length;
  const mBase = n > 0 ? (100 * missBase) / n : 0;
  const mCand = n > 0 ? (100 * missCand) / n : 0;
  const missDelta = mCand - mBase;
  const missCap = mBase < 0.5 ? 0.3 : 0.5;
  const missPass = missDelta <= missCap + 1e-9;

  const sortedByBase = [...ids].sort((a, b) => (baseRank.get(a) ?? 1e9) - (baseRank.get(b) ?? 1e9));
  const top50 = sortedByBase.slice(0, 50);
  const top100 = sortedByBase.slice(0, 100);

  let in80 = 0;
  for (const id of top50) {
    const r = candRank.get(id) ?? 1e9;
    if (r <= 80) in80 += 1;
  }
  const retentionPass = in80 >= 47;

  let top10worst = 0;
  let top20worst = 0;
  for (const id of top50.slice(0, 10)) {
    top10worst = Math.max(top10worst, candRank.get(id) ?? 0);
  }
  for (const id of top50.slice(0, 20)) {
    top20worst = Math.max(top20worst, candRank.get(id) ?? 0);
  }
  const guard10Pass = top10worst <= 35;
  const guard20Pass = top20worst <= 50;

  let in150 = 0;
  for (const id of top100) {
    const r = candRank.get(id) ?? 1e9;
    if (r <= 150) in150 += 1;
  }
  const soft100Pass = in150 >= 92;

  return {
    denominator: n,
    missingProduction: {
      baselineCount: missBase,
      candidateCount: missCand,
      baselinePct: Number(mBase.toFixed(3)),
      candidatePct: Number(mCand.toFixed(3)),
      deltaPct: Number(missDelta.toFixed(3)),
      capAbsPct: missCap,
      pass: missPass,
    },
    eliteTop50: {
      retainedInCandidateTop80: in80,
      required: 47,
      pass: retentionPass,
    },
    worstRankAmongBaselineTop10InCandidate: top10worst,
    worstRankAmongBaselineTop20InCandidate: top20worst,
    guardrails: {
      top10noneBelowRank35: guard10Pass,
      top20noneBelowRank50: guard20Pass,
      pass: guard10Pass && guard20Pass,
    },
    softTop100: {
      retainedInCandidateTop150: in150,
      required: 92,
      pass: soft100Pass,
    },
    overallPass: missPass && retentionPass && guard10Pass && guard20Pass,
  };
}

async function main() {
  const { baseline: baselineRel, candidate: candidateRel } = parseArgs(process.argv);
  const baselinePayload = loadJsonFromRoot(baselineRel);
  const candidatePayload = loadJsonFromRoot(candidateRel);
  const curated = loadRepoJson("src/data/trade-model/curated-snapshot.json");
  const playersMap = await getJson("https://api.sleeper.app/v1/players/nfl");

  const league = { superflex: false, ppr: 1, leagueSize: 12, ...DEFAULT_STARTING_SLOTS };
  const providers = createProviders(curated);

  const bProfiles = baselinePayload.profiles ?? {};
  const cProfiles = candidatePayload.profiles ?? {};
  const anchorsB = buildFpAnchors(bProfiles, league.ppr);
  const anchorsC = buildFpAnchors(cProfiles, league.ppr);
  const richB = buildRichStatAnchors(bProfiles, league.ppr);
  const richC = buildRichStatAnchors(cProfiles, league.ppr);
  const vbdB = computeVbdComputation(bProfiles, league.ppr, league);
  const vbdC = computeVbdComputation(cProfiles, league.ppr, league);
  const fpB = {
    profiles: bProfiles,
    anchors: anchorsB,
    richAnchors: richB,
    vbdBySleeperId: vbdB.bySleeperId,
    vbdScale: vbdB.scale,
  };
  const fpC = {
    profiles: cProfiles,
    anchors: anchorsC,
    richAnchors: richC,
    vbdBySleeperId: vbdC.bySleeperId,
    vbdScale: vbdC.scale,
  };

  const ids = [];
  for (const pid of Object.keys(bProfiles)) {
    const raw = playersMap[pid];
    if (!raw || raw.sport !== "nfl" || raw.status !== "Active") continue;
    const team = (raw.team ?? "").trim();
    if (!team) continue;
    const skills = getSkillFantasyPositions(raw);
    if (skills.length === 0) continue;
    ids.push(pid);
  }

  const baseScores = new Map();
  const candScores = new Map();
  const baseMissing = new Map();
  const candMissing = new Map();

  for (const pid of ids) {
    const raw = playersMap[pid];
    const pos = bProfiles[pid]?.primaryPosition ?? cProfiles[pid]?.primaryPosition;
    if (!pos) continue;
    const team = (raw.team ?? "").trim();
    const sr =
      typeof raw.search_rank === "number" && Number.isFinite(raw.search_rank) && raw.search_rank > 0
        ? raw.search_rank
        : null;
    const input = {
      sleeperPlayerId: pid,
      teamAbbr: team,
      positionLabel: pos,
      searchRank: sr,
      trendingAdds: 0,
      age: resolveAge(raw),
      yearsExp: typeof raw.years_exp === "number" ? raw.years_exp : null,
      nflDraftRound: null,
    };
    const sb = scorePlayerDetailed(input, providers, league, fpB);
    const sc = scorePlayerDetailed(input, providers, league, fpC);
    baseScores.set(pid, sb.value);
    candScores.set(pid, sc.value);
    const pb = productionBaseTradePoints(bProfiles[pid], fpB, league.ppr);
    const pc = productionBaseTradePoints(cProfiles[pid], fpC, league.ppr);
    baseMissing.set(pid, pb.missing);
    candMissing.set(pid, pc.missing);
  }

  const baseRank = rankPlayers(ids, baseScores);
  const candRank = rankPlayers(ids, candScores);
  const gates = evaluateGates(baseRank, candRank, ids, baseMissing, candMissing);

  const idsBoth = ids.filter((id) => bProfiles[id] && cProfiles[id]);
  const baseRankBoth = rankPlayers(idsBoth, baseScores);
  const candRankBoth = rankPlayers(idsBoth, candScores);
  const gatesBoth = evaluateGates(baseRankBoth, candRankBoth, idsBoth, baseMissing, candMissing);

  const out = {
    baselinePath: baselineRel,
    candidatePath: candidateRel,
    baselineSnapshotAsOf: baselinePayload.snapshotAsOf,
    candidateSnapshotAsOf: candidatePayload.snapshotAsOf,
    league,
    acceptanceGates: gates,
    note:
      "When the candidate omits many Sleeper IDs, overall gates reflect missing-production inflation. Use parityOnSharedProfiles for join quality on the intersection.",
    sharedProfileCount: idsBoth.length,
    parityOnSharedProfiles: gatesBoth,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
