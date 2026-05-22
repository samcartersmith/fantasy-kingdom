import type { PlayerIndexEntry } from "@/lib/news/types";
import type { SleeperNflPlayer } from "@/lib/sleeper-types";
import { getSkillFantasyPositions, sleeperDisplayName } from "@/lib/sleeper-ranking";

export function normalizeSearchKey(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function sleeperSearchFullNormalized(raw: SleeperNflPlayer): string {
  const s = (raw as { search_full_name?: string }).search_full_name;
  if (typeof s === "string" && s.trim()) return normalizeSearchKey(s);
  const f = normalizeSearchKey(String(raw.first_name ?? ""));
  const l = normalizeSearchKey(String(raw.last_name ?? ""));
  return `${f}${l}`;
}

export function buildPlayerIndexFromSleeperMap(
  map: Record<string, SleeperNflPlayer | null | undefined>,
): Record<string, PlayerIndexEntry> {
  const out: Record<string, PlayerIndexEntry> = {};
  const now = new Date().toISOString();

  for (const [key, raw] of Object.entries(map)) {
    if (!raw || typeof raw !== "object") continue;
    const pid = String(raw.player_id ?? key);
    if (!/^\d+$/.test(pid)) continue;
    if (raw.sport && raw.sport !== "nfl") continue;
    const team = (raw.team ?? "").trim().toUpperCase();
    if (!team) continue;
    const positions = getSkillFantasyPositions(raw);
    if (positions.length === 0) continue;

    const name = sleeperDisplayName(raw);
    const searchKeys = new Set<string>();
    searchKeys.add(normalizeSearchKey(name));
    searchKeys.add(sleeperSearchFullNormalized(raw));
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      searchKeys.add(normalizeSearchKey(`${parts[0]} ${parts[parts.length - 1]}`));
    }

    const gsis = String(raw.gsis_id ?? "").trim() || undefined;
    out[pid] = {
      sleeperId: pid,
      name,
      team,
      position: positions[0] ?? "FLEX",
      gsisId: gsis,
      imageUrl: `https://sleepercdn.com/content/nfl/players/${pid}.jpg`,
      searchKeys: [...searchKeys].filter(Boolean),
      updatedAt: now,
    };
  }

  return out;
}

export function matchPlayerFromText(
  text: string,
  teamHint: string | null,
  index: Record<string, PlayerIndexEntry>,
): PlayerIndexEntry | null {
  const normalizedHaystack = normalizeSearchKey(text);
  const team = teamHint?.trim().toUpperCase() ?? null;

  let best: { entry: PlayerIndexEntry; score: number } | null = null;

  for (const entry of Object.values(index)) {
    if (team && entry.team !== team) continue;
    for (const key of entry.searchKeys) {
      if (key.length < 4) continue;
      if (!normalizedHaystack.includes(key)) continue;
      const score = key.length + (team ? 10 : 0);
      if (!best || score > best.score) best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

export function resolvePlayerBySleeperId(
  sleeperId: string,
  index: Record<string, PlayerIndexEntry>,
): PlayerIndexEntry | null {
  return index[sleeperId] ?? null;
}

export function toNewsPlayerRef(entry: PlayerIndexEntry) {
  return {
    sleeperId: entry.sleeperId,
    name: entry.name,
    team: entry.team,
    position: entry.position,
    imageUrl: entry.imageUrl,
  };
}
