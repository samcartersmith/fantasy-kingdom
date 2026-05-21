import { SLEEPER_API_V1_BASE } from "@/lib/sleeper-constants";
import type {
  LeagueHistorySeason,
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperDraftTradedPick,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperRoster,
  SleeperTradedPick,
  SleeperUser,
} from "@/lib/sleeper-league-types";

const LEAGUE_REVALIDATE_SECONDS = 600;

async function sleeperGet<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  try {
    const res = await fetch(url, {
      next: { revalidate: LEAGUE_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text().catch(() => "") };
    }
    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: 502, body: text.slice(0, 300) || "Invalid JSON from Sleeper" };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sleeper request failed";
    return { ok: false, status: 502, body: message };
  }
}

export function sleeperUserUrl(usernameOrId: string): string {
  return `${SLEEPER_API_V1_BASE}/user/${encodeURIComponent(usernameOrId.trim())}`;
}

export function sleeperUserLeaguesUrl(userId: string, season: string): string {
  return `${SLEEPER_API_V1_BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${season}`;
}

export async function fetchSleeperUser(
  usernameOrId: string,
): Promise<{ ok: true; data: SleeperUser } | { ok: false; status: number; body: string }> {
  const result = await sleeperGet<SleeperUser>(sleeperUserUrl(usernameOrId));
  if (!result.ok) return result;
  if (!result.data?.user_id) {
    return { ok: false, status: 404, body: "User not found" };
  }
  return result;
}

export async function fetchSleeperUserLeagues(
  userId: string,
  season: string,
): Promise<SleeperLeague[]> {
  const result = await sleeperGet<SleeperLeague[]>(sleeperUserLeaguesUrl(userId, season));
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data.filter((l) => l?.league_id && l?.name);
}

export async function fetchSleeperLeague(leagueId: string): Promise<SleeperLeague | null> {
  const result = await sleeperGet<SleeperLeague>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}`,
  );
  return result.ok ? result.data : null;
}

export async function fetchSleeperLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const result = await sleeperGet<SleeperRoster[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/rosters`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

export async function fetchSleeperLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  const result = await sleeperGet<SleeperLeagueUser[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/users`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

export async function fetchSleeperLeagueTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
  const result = await sleeperGet<SleeperTradedPick[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/traded_picks`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

/** Sleeper: settings.type 2 = dynasty. Also accept explicit dynasty flag when present. */
export function isDynastyLeague(league: SleeperLeague): boolean {
  const t = league.settings?.type;
  if (t === 2) return true;
  if (league.settings?.dynasty === 1) return true;
  return /\bdynasty\b/i.test(league.name);
}

export function currentNflSeasonYears(): string[] {
  const y = new Date().getFullYear();
  return [String(y), String(y - 1)];
}

export async function fetchSleeperLeagueMatchups(
  leagueId: string,
  week: number,
): Promise<SleeperMatchup[]> {
  const result = await sleeperGet<SleeperMatchup[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/matchups/${week}`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data.filter((m) => m?.roster_id != null);
}

export async function fetchSleeperWinnersBracket(leagueId: string): Promise<SleeperBracketMatch[]> {
  const result = await sleeperGet<SleeperBracketMatch[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/winners_bracket`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

export async function fetchSleeperLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const result = await sleeperGet<SleeperDraft[]>(
    `${SLEEPER_API_V1_BASE}/league/${encodeURIComponent(leagueId)}/drafts`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data.filter((d) => d?.draft_id);
}

function coerceRosterId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeDraftPick(raw: Record<string, unknown>): SleeperDraftPick | null {
  const pick_no = typeof raw.pick_no === "number" ? raw.pick_no : Number(raw.pick_no);
  const round = typeof raw.round === "number" ? raw.round : Number(raw.round);
  const roster_id = coerceRosterId(raw.roster_id);
  if (!Number.isFinite(pick_no) || !Number.isFinite(round) || roster_id < 1) return null;
  const draft_slot =
    typeof raw.draft_slot === "number"
      ? raw.draft_slot
      : raw.draft_slot != null
        ? Number(raw.draft_slot)
        : undefined;
  return {
    pick_no,
    round,
    roster_id,
    player_id:
      raw.player_id == null || raw.player_id === ""
        ? null
        : String(raw.player_id),
    picked_by:
      raw.picked_by == null || raw.picked_by === ""
        ? undefined
        : String(raw.picked_by),
    draft_slot: Number.isFinite(draft_slot) && draft_slot! >= 1 ? draft_slot : undefined,
  };
}

export async function fetchSleeperDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  const result = await sleeperGet<Record<string, unknown>[]>(
    `${SLEEPER_API_V1_BASE}/draft/${encodeURIComponent(draftId)}/picks`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  const out: SleeperDraftPick[] = [];
  for (const row of result.data) {
    if (row && typeof row === "object") {
      const pick = normalizeDraftPick(row);
      if (pick) out.push(pick);
    }
  }
  return out;
}

export async function fetchSleeperDraftTradedPicks(
  draftId: string,
): Promise<SleeperDraftTradedPick[]> {
  const result = await sleeperGet<Record<string, unknown>[]>(
    `${SLEEPER_API_V1_BASE}/draft/${encodeURIComponent(draftId)}/traded_picks`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  const out: SleeperDraftTradedPick[] = [];
  for (const row of result.data) {
    if (!row || typeof row !== "object") continue;
    const round = typeof row.round === "number" ? row.round : Number(row.round);
    const roster_id = coerceRosterId(row.roster_id);
    const owner_id = coerceRosterId(row.owner_id);
    const previous_owner_id = coerceRosterId(row.previous_owner_id);
    const season = String(row.season ?? "");
    if (!season || !Number.isFinite(round) || roster_id < 1 || owner_id < 1) continue;
    out.push({
      season,
      round,
      roster_id,
      previous_owner_id: previous_owner_id >= 1 ? previous_owner_id : roster_id,
      owner_id,
    });
  }
  return out;
}

const MAX_HISTORY_SEASONS = 25;

function isValidPreviousLeagueId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const t = id.trim();
  return t.length > 0 && t !== "0";
}

/** Walk `previous_league_id` from the current league back through prior seasons. */
export async function fetchLeagueHistoryChain(
  startLeagueId: string,
  maxSeasons = MAX_HISTORY_SEASONS,
): Promise<LeagueHistorySeason[]> {
  const chain: LeagueHistorySeason[] = [];
  let currentId: string | null = startLeagueId.trim();
  const seen = new Set<string>();

  while (currentId && chain.length < maxSeasons) {
    if (seen.has(currentId)) break;
    seen.add(currentId);

    const league = await fetchSleeperLeague(currentId);
    if (!league?.league_id) break;

    chain.push({
      league_id: league.league_id,
      season: league.season,
      name: league.name,
      status: league.status,
    });

    const prev = league.previous_league_id;
    currentId = isValidPreviousLeagueId(prev) ? prev.trim() : null;
  }

  return chain;
}

const MATCHUP_WEEK_BATCH = 4;
const MAX_MATCHUP_WEEKS = 18;

/** Fetch regular-season matchups for weeks 1..maxWeek in concurrent batches. */
export async function fetchSeasonRegularMatchups(
  leagueId: string,
  maxWeek: number,
): Promise<Map<number, SleeperMatchup[]>> {
  const cap = Math.min(MAX_MATCHUP_WEEKS, Math.max(1, maxWeek));
  const byWeek = new Map<number, SleeperMatchup[]>();

  for (let start = 1; start <= cap; start += MATCHUP_WEEK_BATCH) {
    const end = Math.min(cap, start + MATCHUP_WEEK_BATCH - 1);
    const weeks = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const results = await Promise.all(
      weeks.map(async (w) => ({ week: w, rows: await fetchSleeperLeagueMatchups(leagueId, w) })),
    );
    for (const { week, rows } of results) {
      if (rows.length > 0) byWeek.set(week, rows);
    }
  }

  return byWeek;
}

export function regularSeasonWeekLimit(league: SleeperLeague): number {
  const playoffStart = league.settings?.playoff_week_start;
  if (typeof playoffStart === "number" && playoffStart > 1) {
    return playoffStart - 1;
  }
  return 14;
}

export function rosterOwner(
  rosterId: number,
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
): SleeperLeagueUser | undefined {
  const roster = rosters.find((r) => r.roster_id === rosterId);
  return roster?.owner_id ? users.find((u) => u.user_id === roster.owner_id) : undefined;
}

export function sleeperAvatarUrl(avatar: string | null | undefined): string | undefined {
  const id = avatar?.trim();
  if (!id) return undefined;
  return `https://sleepercdn.com/avatars/${id}`;
}

export function rosterDisplayName(
  rosterId: number,
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
): string {
  const owner = rosterOwner(rosterId, users, rosters);
  return (
    owner?.metadata?.team_name?.trim() ||
    owner?.display_name?.trim() ||
    `Roster ${rosterId}`
  );
}

export function rosterAvatarUrl(
  rosterId: number,
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
): string | undefined {
  return sleeperAvatarUrl(rosterOwner(rosterId, users, rosters)?.avatar);
}

export function leagueUserDisplayName(user: SleeperLeagueUser): string {
  return user.metadata?.team_name?.trim() || user.display_name?.trim() || "Unknown";
}

export type DraftPickTradeMeta = {
  pickedByUserId?: string;
  pickedByName?: string;
  /** Someone other than the roster owner made the selection (proxy, commish). */
  isTradedOrProxy: boolean;
  /** Pre-draft slot trade: pick landed with a new owner. */
  isSlotTrade: boolean;
  /** Display name of the original slot owner (header / table manager column). */
  slotOwnerName?: string;
  /** Team that acquired the slot and made the pick (shown after →). */
  tradedToName?: string;
  draft_slot?: number;
};

export function draftSlotTradeLookup(
  traded: SleeperDraftTradedPick[],
): Map<string, SleeperDraftTradedPick> {
  const map = new Map<string, SleeperDraftTradedPick>();
  for (const t of traded) {
    if (t.owner_id !== t.roster_id) {
      map.set(`${t.round}-${t.roster_id}`, t);
    }
  }
  return map;
}

export function draftPickTradeMeta(
  pick: { roster_id: number; picked_by?: string; draft_slot?: number; round: number },
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
  nameByRoster: Map<number, string>,
  slotTradesByKey: Map<string, SleeperDraftTradedPick>,
  teamsInDraft: number,
): DraftPickTradeMeta {
  const owner = rosterOwner(pick.roster_id, users, rosters);
  const picker = pick.picked_by ? users.find((u) => u.user_id === pick.picked_by) : undefined;
  const pickedByName = picker ? leagueUserDisplayName(picker) : undefined;
  const isTradedOrProxy = Boolean(
    pick.picked_by && owner?.user_id && pick.picked_by !== owner.user_id,
  );

  const slotKeys = [
    pick.draft_slot != null ? `${pick.round}-${pick.draft_slot}` : null,
    `${pick.round}-${pick.roster_id}`,
  ].filter(Boolean) as string[];

  let slotTrade: SleeperDraftTradedPick | undefined;
  for (const key of slotKeys) {
    slotTrade = slotTradesByKey.get(key);
    if (slotTrade) break;
  }
  if (!slotTrade) {
    slotTrade = [...slotTradesByKey.values()].find(
      (t) =>
        t.round === pick.round &&
        t.owner_id === pick.roster_id &&
        t.owner_id !== t.roster_id,
    );
  }

  const isSlotTrade = Boolean(
    slotTrade &&
      slotTrade.owner_id === pick.roster_id &&
      slotTrade.owner_id !== slotTrade.roster_id,
  );
  const slotOwnerRosterId = slotTrade?.roster_id ?? pick.roster_id;
  const slotOwnerName =
    nameByRoster.get(slotOwnerRosterId) ?? `Roster ${slotOwnerRosterId}`;
  const tradedToName = isSlotTrade
    ? nameByRoster.get(pick.roster_id) ?? `Roster ${pick.roster_id}`
    : undefined;

  return {
    pickedByUserId: pick.picked_by,
    pickedByName,
    isTradedOrProxy: isSlotTrade ? false : isTradedOrProxy,
    isSlotTrade,
    slotOwnerName,
    tradedToName,
    draft_slot: pick.draft_slot,
  };
}
