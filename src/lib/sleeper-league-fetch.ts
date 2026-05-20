import { SLEEPER_API_V1_BASE } from "@/lib/sleeper-constants";
import type {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperUser,
} from "@/lib/sleeper-league-types";

const LEAGUE_REVALIDATE_SECONDS = 600;

async function sleeperGet<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(url, {
    next: { revalidate: LEAGUE_REVALIDATE_SECONDS },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text().catch(() => "") };
  }
  return { ok: true, data: (await res.json()) as T };
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
