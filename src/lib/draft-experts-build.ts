import {
  buildBusts,
  buildManagerEffectiveness,
  buildMostPicks,
  buildSteals,
  enrichPick,
  maxRoundFromPicks,
  selectAnnualDraftForSeason,
  teamCountFromDraft,
  type EnrichedPick,
  type StealBustRow,
} from "@/lib/draft-experts-aggregate";
import { buildDraftPlayerTradeValueResolver } from "@/lib/draft-player-trade-value";
import { leagueContextFromSleeper } from "@/lib/league-context-from-sleeper";
import { fetchSleeperNflPlayersMap, fetchSleeperTrendingAdds } from "@/lib/sleeper-fetch";
import {
  fetchLeagueHistoryChain,
  fetchSleeperDraftPicks,
  fetchSleeperLeague,
  fetchSleeperLeagueDrafts,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  rosterDisplayName,
} from "@/lib/sleeper-league-fetch";
import type { SleeperNflPlayer } from "@/lib/sleeper-types";

export type DraftExpertsManager = {
  roster_id: number;
  name: string;
};

export type DraftExpertsIncludedDraft = {
  season: string;
  draft_id: string;
  league_id: string;
  pickCount: number;
  rounds: number;
};

export type DraftExpertsExcludedDraft = {
  season: string;
  draft_id: string;
  reason: "startup";
  pickCount: number;
  maxRound: number;
};

export type DraftExpertsPickRow = {
  pick_no: number;
  round: number;
  roster_id: number;
  managerName: string;
  playerId: string;
  playerName: string;
  position: string;
  currentValue: number;
  slotPoints: number;
  vsSlotRatio: number;
};

export type DraftExpertsPayload = {
  league: {
    name: string;
    currentSeason: string;
    seasonsIncluded: string[];
  };
  managers: Record<string, DraftExpertsManager>;
  drafts: DraftExpertsIncludedDraft[];
  excludedDrafts: DraftExpertsExcludedDraft[];
  overview: {
    effectiveness: { roster_id: number; name: string; avgVsSlotRatio: number; pickCount: number }[];
    mostPicks: { roster_id: number; name: string; pickCount: number }[];
    bestDrafter: { roster_id: number; name: string; avgVsSlotRatio: number } | null;
    worstDrafter: { roster_id: number; name: string; avgVsSlotRatio: number } | null;
  };
  bySeason: Record<string, { picks: DraftExpertsPickRow[] }>;
  steals: StealBustRow[];
  busts: StealBustRow[];
  meta: {
    dataNote: string;
    playersUnmatched: number;
    leagueSize: number;
  };
};

export async function buildDraftExpertsPayload(
  startLeagueId: string,
): Promise<DraftExpertsPayload | null> {
  const startLeague = await fetchSleeperLeague(startLeagueId);
  if (!startLeague) return null;

  const [chain, playersResult, trendingAdds] = await Promise.all([
    fetchLeagueHistoryChain(startLeagueId),
    fetchSleeperNflPlayersMap(),
    fetchSleeperTrendingAdds(120, 72),
  ]);

  if (!playersResult.ok) return null;
  const playersMap = playersResult.data;

  const leagueContext = leagueContextFromSleeper(startLeague);
  const tradeValues = await buildDraftPlayerTradeValueResolver(
    leagueContext,
    playersMap,
    trendingAdds,
  );
  if (!tradeValues) return null;

  const nameByRoster = new Map<number, string>();
  const includedDrafts: DraftExpertsIncludedDraft[] = [];
  const excludedDrafts: DraftExpertsExcludedDraft[] = [];
  const bySeason: Record<string, { picks: DraftExpertsPickRow[] }> = {};
  const allEnriched: EnrichedPick[] = [];
  let playersUnmatched = 0;
  let leagueSize = startLeague.total_rosters || 12;

  for (const seasonEntry of chain) {
    const league = await fetchSleeperLeague(seasonEntry.league_id);
    if (!league) continue;

    leagueSize = Math.max(leagueSize, league.total_rosters || 12);

    const [users, rosters, draftList] = await Promise.all([
      fetchSleeperLeagueUsers(seasonEntry.league_id),
      fetchSleeperLeagueRosters(seasonEntry.league_id),
      fetchSleeperLeagueDrafts(seasonEntry.league_id),
    ]);

    for (const r of rosters) {
      if (!nameByRoster.has(r.roster_id)) {
        nameByRoster.set(r.roster_id, rosterDisplayName(r.roster_id, users, rosters));
      }
    }

    const withPicks = await Promise.all(
      draftList.map(async (draft) => ({
        draft,
        picks: await fetchSleeperDraftPicks(draft.draft_id),
      })),
    );

    const { included, excluded } = selectAnnualDraftForSeason(withPicks);

    for (const ex of excluded) {
      excludedDrafts.push({
        season: ex.season,
        draft_id: ex.draft_id,
        reason: "startup",
        pickCount: ex.pickCount,
        maxRound: ex.maxRound,
      });
    }

    if (!included) continue;

    const teams = teamCountFromDraft(included.draft, included.picks);
    const totalRounds = maxRoundFromPicks(included.picks);
    const season = included.draft.season;

    includedDrafts.push({
      season,
      draft_id: included.draft.draft_id,
      league_id: seasonEntry.league_id,
      pickCount: included.picks.length,
      rounds: totalRounds,
    });

    const seasonPicks: DraftExpertsPickRow[] = [];

    for (const pick of [...included.picks].sort((a, b) => a.pick_no - b.pick_no)) {
      const player = pick.player_id ? playersMap[pick.player_id] : null;
      const managerName = nameByRoster.get(pick.roster_id) ?? `Roster ${pick.roster_id}`;
      const enriched = enrichPick(
        pick,
        season,
        included.draft.draft_id,
        managerName,
        player as SleeperNflPlayer | null,
        tradeValues,
        teams,
        totalRounds,
      );
      if (!enriched) {
        if (pick.player_id && pick.player_id !== "0") playersUnmatched += 1;
        continue;
      }
      allEnriched.push(enriched);
      seasonPicks.push({
        pick_no: enriched.pick_no,
        round: enriched.round,
        roster_id: enriched.roster_id,
        managerName: enriched.managerName,
        playerId: enriched.playerId,
        playerName: enriched.playerName,
        position: enriched.position,
        currentValue: enriched.currentValue,
        slotPoints: enriched.slotPoints,
        vsSlotRatio: enriched.vsSlotRatio,
      });
    }

    bySeason[season] = { picks: seasonPicks };
  }

  includedDrafts.sort((a, b) => Number(b.season) - Number(a.season));
  const seasonsIncluded = includedDrafts.map((d) => d.season);

  const effectiveness = buildManagerEffectiveness(allEnriched, nameByRoster);
  const mostPicks = buildMostPicks(allEnriched, nameByRoster);
  const steals = buildSteals(allEnriched);
  const busts = buildBusts(allEnriched, leagueSize);

  const managers: Record<string, DraftExpertsManager> = {};
  for (const [roster_id, name] of nameByRoster) {
    managers[String(roster_id)] = { roster_id, name };
  }

  return {
    league: {
      name: startLeague.name,
      currentSeason: startLeague.season,
      seasonsIncluded,
    },
    managers,
    drafts: includedDrafts,
    excludedDrafts,
    overview: {
      effectiveness,
      mostPicks,
      bestDrafter: effectiveness[0]
        ? {
            roster_id: effectiveness[0].roster_id,
            name: effectiveness[0].name,
            avgVsSlotRatio: effectiveness[0].avgVsSlotRatio,
          }
        : null,
      worstDrafter: effectiveness.length > 0
        ? {
            roster_id: effectiveness[effectiveness.length - 1]!.roster_id,
            name: effectiveness[effectiveness.length - 1]!.name,
            avgVsSlotRatio: effectiveness[effectiveness.length - 1]!.avgVsSlotRatio,
          }
        : null,
    },
    bySeason,
    steals,
    busts,
    meta: {
      dataNote:
        "Pick pts follow a draft slot value curve aligned with trade calculator pick anchors (e.g. ~5,000 at 1.01, ~800 at the last pick in a 4-round board). Player trade pts use the same fair-trade model as the trade calculator for this league’s format. Vs slot is trade pts ÷ pick pts. Same curve for every season. Startup drafts with many rounds are excluded.",
      playersUnmatched,
      leagueSize,
    },
  };
}
