import type { CatalogAsset } from "@/lib/trade-types";
import { catalogPlayerHasSkillPosition } from "@/lib/trade-types";
import type { SleeperRoster } from "@/lib/sleeper-league-types";

export type RosterSlot = "starter" | "bench" | "reserve" | "taxi";

export type RosterPlayerRow = {
  sleeperPlayerId: string;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  age: number | null;
  slot: RosterSlot;
  trendingAdds: number;
};

export type GuidanceTone = "neutral" | "positive" | "caution" | "opportunity";

export type GuidanceInsight = {
  id: string;
  tone: GuidanceTone;
  title: string;
  body: string;
};

export type RosterGuidancePayload = {
  totalValue: number;
  valueRank: number;
  leagueRosterCount: number;
  players: RosterPlayerRow[];
  insights: GuidanceInsight[];
};

type Skill = "QB" | "RB" | "WR" | "TE";

const SKILLS: Skill[] = ["QB", "RB", "WR", "TE"];

function skillFromPosition(position: string | null): Skill | null {
  if (!position) return null;
  for (const s of SKILLS) {
    if (catalogPlayerHasSkillPosition(position, s)) return s;
  }
  return null;
}

function slotForPlayer(
  playerId: string,
  roster: SleeperRoster,
): RosterSlot {
  const starters = new Set((roster.starters ?? []).filter(Boolean));
  const reserve = new Set((roster.reserve ?? []).filter(Boolean));
  const taxi = new Set((roster.taxi ?? []).filter(Boolean));
  if (starters.has(playerId)) return "starter";
  if (reserve.has(playerId)) return "reserve";
  if (taxi.has(playerId)) return "taxi";
  return "bench";
}

export function buildRosterPlayerRows(
  roster: SleeperRoster,
  catalogById: Map<string, CatalogAsset>,
): RosterPlayerRow[] {
  const ids = (roster.players ?? []).filter((id) => id && id !== "0");
  const rows: RosterPlayerRow[] = [];
  for (const id of ids) {
    const asset = catalogById.get(id);
    if (!asset || asset.kind !== "player") continue;
    rows.push({
      sleeperPlayerId: id,
      name: asset.name,
      position: asset.position,
      team: asset.team,
      value: asset.value,
      age: asset.age ?? null,
      slot: slotForPlayer(id, roster),
      trendingAdds: asset.sleeperTrendingAdds ?? 0,
    });
  }
  return rows.sort((a, b) => b.value - a.value);
}

function sumTop(values: number[], n: number): number {
  return values
    .slice()
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((a, b) => a + b, 0);
}

type StartSlots = { qb: number; rb: number; wr: number; te: number };

const START_SLOT_BY_SKILL: Record<Skill, keyof StartSlots> = {
  QB: "qb",
  RB: "rb",
  WR: "wr",
  TE: "te",
};

function slotsForSkill(skill: Skill, startSlots: StartSlots): number {
  return startSlots[START_SLOT_BY_SKILL[skill]];
}

function positionRoomStrength(players: RosterPlayerRow[], skill: Skill, startSlots: StartSlots): number {
  const pool = players.filter((p) => skillFromPosition(p.position) === skill);
  if (pool.length === 0) return 0;
  return sumTop(
    pool.map((p) => p.value),
    Math.max(1, slotsForSkill(skill, startSlots)),
  );
}

export function sumRosterValue(
  roster: SleeperRoster,
  catalogById: Map<string, CatalogAsset>,
): number {
  return buildRosterPlayerRows(roster, catalogById).reduce((a, p) => a + p.value, 0);
}

export function rankRosterValues(
  rosters: SleeperRoster[],
  catalogById: Map<string, CatalogAsset>,
  targetRosterId: number,
): { rank: number; total: number } {
  const totals = rosters.map((r) => ({
    rosterId: r.roster_id,
    total: sumRosterValue(r, catalogById),
  }));
  totals.sort((a, b) => b.total - a.total);
  const ix = totals.findIndex((t) => t.rosterId === targetRosterId);
  return { rank: ix >= 0 ? ix + 1 : totals.length, total: totals.length };
}

export function buildRosterGuidance(
  players: RosterPlayerRow[],
  rank: { rank: number; total: number },
  leagueContextLabel: string,
  startSlots: StartSlots,
): GuidanceInsight[] {
  const insights: GuidanceInsight[] = [];
  const totalValue = players.reduce((a, p) => a + p.value, 0);

  insights.push({
    id: "value-rank",
    tone: rank.rank <= Math.ceil(rank.total / 3) ? "positive" : rank.rank >= rank.total - 1 ? "caution" : "neutral",
    title: "Roster value rank",
    body: `Your modeled roster total is ${totalValue.toLocaleString()} (${leagueContextLabel}), rank ${rank.rank} of ${rank.total} teams in this league.`,
  });

  const roomScores = SKILLS.map((skill) => ({
    skill,
    score: positionRoomStrength(players, skill, startSlots),
  })).filter((r) => r.score > 0);

  if (roomScores.length >= 2) {
    const sorted = roomScores.slice().sort((a, b) => b.score - a.score);
    const best = sorted[0]!;
    const thin = sorted[sorted.length - 1]!;
    if (best.skill !== thin.skill) {
      insights.push({
        id: "strong-room",
        tone: "positive",
        title: `Strongest room: ${best.skill}`,
        body: `Top ${best.skill} capital is your clearest edge. ${thin.skill} is the thinnest starter room relative to the rest of your roster.`,
      });
    }
  }

  const bench = players.filter((p) => p.slot !== "starter");
  const tradeCandidates = bench
    .filter((p) => {
      const skill = skillFromPosition(p.position);
      if (!skill) return false;
      const atPosition = players.filter((x) => skillFromPosition(x.position) === skill);
      const slots = slotsForSkill(skill, startSlots);
      const starterCutoff = sumTop(
        atPosition.map((x) => x.value),
        slots,
      );
      return p.value >= starterCutoff * 0.85 && atPosition.length > slots + 1;
    })
    .sort((a, b) => b.value - a.value);

  if (tradeCandidates[0]) {
    const c = tradeCandidates[0];
    insights.push({
      id: "trade-chip",
      tone: "opportunity",
      title: "Trade chip",
      body: `${c.name} (${c.value.toLocaleString()}) is high value on your bench. Consider packaging in a deal if you are upgrading a starter spot.`,
    });
  }

  const trending = players.filter((p) => p.trendingAdds > 0).sort((a, b) => b.trendingAdds - a.trendingAdds)[0];
  if (trending && trending.trendingAdds >= 3) {
    insights.push({
      id: "trending",
      tone: "opportunity",
      title: "Sleeper buzz",
      body: `${trending.name} is seeing add activity in Sleeper trending data. Market interest may help you buy low elsewhere or sell at a peak.`,
    });
  }

  const ageRisk = players
    .filter((p) => p.age != null && p.age >= 29 && skillFromPosition(p.position) === "RB" && p.value >= 4500)
    .sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0];
  if (ageRisk) {
    insights.push({
      id: "age-rb",
      tone: "caution",
      title: "Age window",
      body: `${ageRisk.name} (${ageRisk.age}) is an older RB with still-strong modeled value. Dynasty windows close fast; plan your exit if you are rebuilding.`,
    });
  }

  const youngCore = players.filter((p) => p.age != null && p.age <= 24 && p.value >= 5500).length;
  if (youngCore >= 3) {
    insights.push({
      id: "youth",
      tone: "positive",
      title: "Youth core",
      body: `You have ${youngCore} players age 24 or younger above 5,500 value. That supports a longer rebuild or retool timeline.`,
    });
  }

  return insights.slice(0, 6);
}

export function buildRosterGuidancePayload(
  roster: SleeperRoster,
  allRosters: SleeperRoster[],
  catalogById: Map<string, CatalogAsset>,
  leagueContextLabel: string,
  startSlots: StartSlots,
): RosterGuidancePayload {
  const players = buildRosterPlayerRows(roster, catalogById);
  const rank = rankRosterValues(allRosters, catalogById, roster.roster_id);
  const totalValue = players.reduce((a, p) => a + p.value, 0);
  return {
    totalValue,
    valueRank: rank.rank,
    leagueRosterCount: rank.total,
    players,
    insights: buildRosterGuidance(players, rank, leagueContextLabel, startSlots),
  };
}
