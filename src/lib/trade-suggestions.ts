import type { CatalogAsset } from "@/lib/trade-types";
import {
  buildRosterProfile,
  getDepthSurplusPlayers,
  positionRoomStrength,
  ROSTER_SKILLS,
  skillFromPosition,
  slotsForSkill,
  type RosterPlayerRow,
  type RosterProfile,
  type Skill,
  type StartSlots,
} from "@/lib/roster-guidance";
import {
  fairnessTierFromDelta,
  gapPoints,
  TRADE_CLEARLY_UNEVEN_POINTS,
  TRADE_EVEN_MARGIN_POINTS,
  type FairnessTier,
} from "@/lib/trade-evaluation-copy";
import type { SleeperLeagueUser, SleeperRoster, SleeperTradedPick } from "@/lib/sleeper-league-types";

export type TradeSuggestionAsset = {
  kind: "player" | "pick";
  id: string;
  name: string;
  position?: string | null;
  value: number;
  sleeperPlayerId?: string;
  /** Sleeper CDN headshot; players only. */
  imageUrl?: string | null;
};

export type TradeSuggestion = {
  id: string;
  rank: number;
  partnerRosterId: number;
  team1Name: string;
  team2Name: string;
  team1Give: TradeSuggestionAsset[];
  team1Receive: TradeSuggestionAsset[];
  total1: number;
  total2: number;
  fairnessTier: FairnessTier;
  headline: string;
  rationale: string;
  score: number;
};

export type OwnedPick = {
  season: number;
  round: number;
  rosterId: number;
  catalogAsset: CatalogAsset;
};

function playerToAsset(
  p: RosterPlayerRow,
  catalogById: Map<string, CatalogAsset>,
): TradeSuggestionAsset {
  const catalog = catalogById.get(p.sleeperPlayerId);
  return {
    kind: "player",
    id: p.sleeperPlayerId,
    name: p.name,
    position: p.position,
    value: p.value,
    sleeperPlayerId: p.sleeperPlayerId,
    imageUrl: catalog?.imageUrl ?? null,
  };
}

function pickToAsset(p: CatalogAsset): TradeSuggestionAsset {
  return {
    kind: "pick",
    id: p.id,
    name: p.name,
    position: p.position,
    value: p.value,
  };
}

function sumAssetValues(assets: TradeSuggestionAsset[]): number {
  return assets.reduce((a, x) => a + x.value, 0);
}

function fairnessTierWeight(tier: FairnessTier): number {
  if (tier === "even") return 0;
  if (tier === "lean") return 1;
  return 2;
}

function simulateRoster(
  players: RosterPlayerRow[],
  removeIds: Set<string>,
  add: RosterPlayerRow[],
): RosterPlayerRow[] {
  const kept = players.filter((p) => !removeIds.has(p.sleeperPlayerId));
  return [...kept, ...add];
}

function passesNonDegradation(
  before: RosterPlayerRow[],
  after: RosterPlayerRow[],
  receiveSkill: Skill,
  startSlots: StartSlots,
): boolean {
  for (const skill of ROSTER_SKILLS) {
    const pre = positionRoomStrength(before, skill, startSlots);
    const post = positionRoomStrength(after, skill, startSlots);
    if (post < pre) return false;
  }
  const preReceive = positionRoomStrength(before, receiveSkill, startSlots);
  const postReceive = positionRoomStrength(after, receiveSkill, startSlots);
  return postReceive > preReceive;
}

function partnerCanTradePlayer(
  partner: RosterProfile,
  player: RosterPlayerRow,
  skill: Skill,
  startSlots: StartSlots,
): boolean {
  if (skillFromPosition(player.position) !== skill) return false;
  const atPos = partner.players.filter((p) => skillFromPosition(p.position) === skill);
  const slots = slotsForSkill(skill, startSlots);
  if (player.slot === "starter" && atPos.filter((p) => p.slot === "starter").length <= slots) {
    return false;
  }
  return true;
}

function partnerReceivablePlayers(
  partner: RosterProfile,
  receiveSkill: Skill,
  startSlots: StartSlots,
): RosterPlayerRow[] {
  return partner.players
    .filter((p) => skillFromPosition(p.position) === receiveSkill)
    .filter((p) => partnerCanTradePlayer(partner, p, receiveSkill, startSlots))
    .sort((a, b) => {
      const benchA = a.slot !== "starter" ? 1 : 0;
      const benchB = b.slot !== "starter" ? 1 : 0;
      if (benchB !== benchA) return benchB - benchA;
      return b.value - a.value;
    });
}

function mapTradedPicksToCatalog(
  traded: SleeperTradedPick[],
  pickCatalogById: Map<string, CatalogAsset>,
): OwnedPick[] {
  const out: OwnedPick[] = [];
  for (const tp of traded) {
    const year = Number(tp.season);
    const round = tp.round;
    if (!Number.isFinite(year) || !Number.isFinite(round)) continue;
    const id = `pick_${year}_mid_${round}`;
    const asset = pickCatalogById.get(id);
    if (!asset) continue;
    out.push({
      season: year,
      round,
      rosterId: tp.owner_id,
      catalogAsset: asset,
    });
  }
  return out;
}

function resolveTeamName(
  roster: SleeperRoster,
  userById: Map<string, SleeperLeagueUser>,
): string {
  const owner = roster.owner_id ? userById.get(roster.owner_id) : undefined;
  return (
    owner?.metadata?.team_name?.trim() ||
    owner?.display_name?.trim() ||
    `Roster ${roster.roster_id}`
  );
}

function buildCandidate(
  my: RosterProfile,
  partner: RosterProfile,
  receiveSkill: Skill,
  sendSkill: Skill,
  team1Give: TradeSuggestionAsset[],
  team1Receive: TradeSuggestionAsset[],
  startSlots: StartSlots,
  packageType: string,
): Omit<TradeSuggestion, "rank" | "id"> | null {
  const givePlayers = team1Give.filter((a) => a.kind === "player");
  const receivePlayers = team1Receive.filter((a) => a.kind === "player");
  if (givePlayers.length === 0 || receivePlayers.length === 0) return null;

  const removeIds = new Set(givePlayers.map((g) => g.sleeperPlayerId!).filter(Boolean));
  const addRows = receivePlayers
    .map((r) => partner.players.find((p) => p.sleeperPlayerId === r.sleeperPlayerId))
    .filter((p): p is RosterPlayerRow => Boolean(p));

  const after = simulateRoster(my.players, removeIds, addRows);
  if (!passesNonDegradation(my.players, after, receiveSkill, startSlots)) return null;

  const total1 = sumAssetValues(team1Give);
  const total2 = sumAssetValues(team1Receive);
  const delta = total1 - total2;
  const tier = fairnessTierFromDelta(delta);
  const gap = gapPoints(total1, total2);

  if (tier === "uneven" && gap >= TRADE_CLEARLY_UNEVEN_POINTS) return null;

  const preReceive = positionRoomStrength(my.players, receiveSkill, startSlots);
  const postReceive = positionRoomStrength(after, receiveSkill, startSlots);
  const roomGain = postReceive - preReceive;

  const score =
    roomGain * 10_000 +
    (2 - fairnessTierWeight(tier)) * 1_000 -
    gap +
    (packageType === "1for1" ? 50 : packageType === "2for1" ? 30 : 10);

  const headline = `Upgrade ${receiveSkill} via ${partner.teamName}`;
  const rationale = `Trade ${sendSkill} depth (${team1Give.map((a) => a.name).join(", ")}) for ${receiveSkill} help (${team1Receive.map((a) => a.name).join(", ")}). Your ${receiveSkill} room improves without weakening other positions.`;

  return {
    partnerRosterId: partner.rosterId,
    team1Name: my.teamName,
    team2Name: partner.teamName,
    team1Give,
    team1Receive,
    total1,
    total2,
    fairnessTier: tier,
    headline,
    rationale,
    score,
  };
}

function generateCandidatesForPair(
  my: RosterProfile,
  partner: RosterProfile,
  receiveSkill: Skill,
  sendSkill: Skill,
  startSlots: StartSlots,
  myPicks: OwnedPick[],
  catalogById: Map<string, CatalogAsset>,
): Omit<TradeSuggestion, "rank" | "id">[] {
  const candidates: Omit<TradeSuggestion, "rank" | "id">[] = [];
  const mySurplus = getDepthSurplusPlayers(my.players, startSlots, my.weakSkills).filter(
    (p) => skillFromPosition(p.position) === sendSkill,
  );
  const partnerPool = partnerReceivablePlayers(partner, receiveSkill, startSlots);

  if (mySurplus.length === 0 || partnerPool.length === 0) return candidates;

  for (let i = 0; i < Math.min(3, mySurplus.length); i++) {
    for (let j = 0; j < Math.min(3, partnerPool.length); j++) {
      const give = mySurplus[i]!;
      const recv = partnerPool[j]!;
      const c = buildCandidate(
        my,
        partner,
        receiveSkill,
        sendSkill,
        [playerToAsset(give, catalogById)],
        [playerToAsset(recv, catalogById)],
        startSlots,
        "1for1",
      );
      if (c) candidates.push(c);
    }
  }

  if (mySurplus.length >= 2) {
    for (const recv of partnerPool.slice(0, 4)) {
      const g1 = mySurplus[0]!;
      const g2 = mySurplus[1]!;
      const giveSum = g1.value + g2.value;
      if (recv.value < giveSum * 0.88 || recv.value > giveSum * 1.2) continue;
      const c = buildCandidate(
        my,
        partner,
        receiveSkill,
        sendSkill,
        [playerToAsset(g1, catalogById), playerToAsset(g2, catalogById)],
        [playerToAsset(recv, catalogById)],
        startSlots,
        "2for1",
      );
      if (c) candidates.push(c);
    }
  }

  const rosterPicks = myPicks.filter((p) => p.rosterId === my.rosterId);
  if (rosterPicks.length > 0 && mySurplus.length > 0) {
    for (const give of mySurplus.slice(0, 2)) {
      for (const recv of partnerPool.slice(0, 3)) {
        for (const pick of rosterPicks.slice(0, 2)) {
          const gap = recv.value - give.value;
          if (gap <= 0 || gap > pick.catalogAsset.value * 1.5) continue;
          const c = buildCandidate(
            my,
            partner,
            receiveSkill,
            sendSkill,
            [playerToAsset(give, catalogById), pickToAsset(pick.catalogAsset)],
            [playerToAsset(recv, catalogById)],
            startSlots,
            "1plusPick",
          );
          if (c) candidates.push(c);
        }
      }
    }
  }

  return candidates;
}

function rankAndDedupe(
  raw: Omit<TradeSuggestion, "rank" | "id">[],
): TradeSuggestion[] {
  const sorted = raw.slice().sort((a, b) => b.score - a.score);
  const picked: TradeSuggestion[] = [];
  const usedPartners = new Set<number>();
  const usedSignatures = new Set<string>();

  for (const c of sorted) {
    const sig = `${c.partnerRosterId}:${c.team1Give.map((a) => a.id).join(",")}:${c.team1Receive.map((a) => a.id).join(",")}`;
    if (usedSignatures.has(sig)) continue;

    if (picked.length < 3 && usedPartners.has(c.partnerRosterId)) {
      if (picked.filter((p) => p.partnerRosterId === c.partnerRosterId).length >= 1) continue;
    }

    usedSignatures.add(sig);
    usedPartners.add(c.partnerRosterId);
    picked.push({
      ...c,
      id: `sug-${c.partnerRosterId}-${picked.length}`,
      rank: picked.length + 1,
    });
    if (picked.length >= 10) break;
  }

  return picked;
}

export type FindTradeSuggestionsInput = {
  targetRosterId: number;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  catalogById: Map<string, CatalogAsset>;
  pickCatalogById: Map<string, CatalogAsset>;
  tradedPicks: SleeperTradedPick[];
  startSlots: StartSlots;
  limit: number;
  offset: number;
  excludeIds?: string[];
};

export function findTradeSuggestions(input: FindTradeSuggestionsInput): {
  suggestions: TradeSuggestion[];
  totalCandidates: number;
} {
  const userById = new Map(input.users.map((u) => [u.user_id, u]));
  const myRoster = input.rosters.find((r) => r.roster_id === input.targetRosterId);
  if (!myRoster) return { suggestions: [], totalCandidates: 0 };

  const my = buildRosterProfile(
    myRoster,
    input.catalogById,
    input.startSlots,
    resolveTeamName(myRoster, userById),
  );

  if (my.weakSkills.length === 0) return { suggestions: [], totalCandidates: 0 };

  const receiveSkill = my.weakSkills[0]!;
  const ownedPicks = mapTradedPicksToCatalog(input.tradedPicks, input.pickCatalogById);

  const raw: Omit<TradeSuggestion, "rank" | "id">[] = [];

  for (const roster of input.rosters) {
    if (roster.roster_id === input.targetRosterId) continue;
    const partner = buildRosterProfile(
      roster,
      input.catalogById,
      input.startSlots,
      resolveTeamName(roster, userById),
    );

    for (const sendSkill of partner.weakSkills) {
      if (sendSkill === receiveSkill) continue;
      if (
        !getDepthSurplusPlayers(my.players, input.startSlots, my.weakSkills).some(
          (p) => skillFromPosition(p.position) === sendSkill,
        )
      ) {
        continue;
      }
      raw.push(
        ...generateCandidatesForPair(
          my,
          partner,
          receiveSkill,
          sendSkill,
          input.startSlots,
          ownedPicks,
          input.catalogById,
        ),
      );
    }

    for (const sendSkill of my.strongSkills) {
      if (sendSkill === receiveSkill) continue;
      if (
        !getDepthSurplusPlayers(my.players, input.startSlots, my.weakSkills).some(
          (p) => skillFromPosition(p.position) === sendSkill,
        )
      ) {
        continue;
      }
      if (!partner.weakSkills.includes(sendSkill)) continue;
      raw.push(
        ...generateCandidatesForPair(
          my,
          partner,
          receiveSkill,
          sendSkill,
          input.startSlots,
          ownedPicks,
          input.catalogById,
        ),
      );
    }
  }

  let ranked = rankAndDedupe(raw);

  if (input.excludeIds?.length) {
    const exclude = new Set(input.excludeIds);
    ranked = ranked.filter((s) => !exclude.has(s.id));
  }

  const totalCandidates = ranked.length;
  const slice = ranked.slice(input.offset, input.offset + input.limit);

  return { suggestions: slice, totalCandidates };
}

export const TRADE_SUGGESTIONS_VALUE_NOTE =
  "Values use the same fair-trade model as the trade calculator, with league PPR, size, and superflex from Sleeper settings. Suggestions optimize positional fit; verify picks and deals in Sleeper before proposing.";
