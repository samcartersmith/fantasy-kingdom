import {
  SLEEPER_NFL_PLAYERS_URL,
  SLEEPER_PLAYERS_REVALIDATE_SECONDS,
  SLEEPER_TRENDING_REVALIDATE_SECONDS,
  sleeperTrendingAddsUrl,
} from "@/lib/sleeper-constants";
import type { SleeperNflPlayersMap, SleeperTrendingRow } from "@/lib/sleeper-types";

export async function fetchSleeperNflPlayersMap(): Promise<{ ok: true; data: SleeperNflPlayersMap } | { ok: false; status: number; body: string }> {
  const res = await fetch(SLEEPER_NFL_PLAYERS_URL, {
    next: { revalidate: SLEEPER_PLAYERS_REVALIDATE_SECONDS },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text().catch(() => "") };
  }
  const data = (await res.json()) as SleeperNflPlayersMap;
  return { ok: true, data };
}

/** Add counts from Sleeper trending endpoint (last N hours). */
export async function fetchSleeperTrendingAdds(
  limit = 100,
  lookbackHours = 72,
): Promise<Map<string, number>> {
  const url = sleeperTrendingAddsUrl(limit, lookbackHours);
  try {
    const res = await fetch(url, {
      next: { revalidate: SLEEPER_TRENDING_REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return new Map();
    const rows = (await res.json()) as SleeperTrendingRow[];
    if (!Array.isArray(rows)) return new Map();
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r?.player_id && typeof r.count === "number") m.set(String(r.player_id), r.count);
    }
    return m;
  } catch {
    return new Map();
  }
}
