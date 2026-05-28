import { SLEEPER_API_V1_BASE } from "@/lib/sleeper-constants";

export type SleeperNflState = {
  season: string;
  week: number;
  season_type: string;
  display_week?: number;
  league_season?: string;
};

const NFL_STATE_REVALIDATE_SECONDS = 300;

export async function fetchSleeperNflState(): Promise<SleeperNflState | null> {
  try {
    const res = await fetch(`${SLEEPER_API_V1_BASE}/state/nfl`, {
      next: { revalidate: NFL_STATE_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const season = String(data.season ?? "");
    const week = typeof data.week === "number" ? data.week : Number(data.week);
    if (!season || !Number.isFinite(week)) return null;
    return {
      season,
      week: Math.max(0, Math.floor(week)),
      season_type: String(data.season_type ?? "regular"),
      display_week:
        typeof data.display_week === "number" ? data.display_week : undefined,
      league_season:
        typeof data.league_season === "string" ? data.league_season : undefined,
    };
  } catch {
    return null;
  }
}
