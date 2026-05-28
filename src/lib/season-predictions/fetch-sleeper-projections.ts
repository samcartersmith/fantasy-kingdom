import type { PprMode } from "@/lib/trade-model/types";
import type { SkillPosition } from "@/lib/sleeper-ranking";
import {
  fantasyPointsFromProjectionRow,
  scoringSettingsCacheKey,
} from "@/lib/season-predictions/league-projection-points";
import {
  isSleeperTeamDefenseId,
  rawPositionHintForPlayerId,
  skillPositionsFromProjectionStats,
} from "@/lib/season-predictions/projection-position-inference";
import {
  rawPositionFromProjectionRow,
  skillPositionsFromProjectionRow,
} from "@/lib/season-predictions/player-positions";

const DEFAULT_PROJECTION_CONCURRENCY = 4;

/** Weekly projection payloads are ~7MB — above Next.js Data Cache ~2MB limit. */
const PROJECTION_FETCH_INIT: RequestInit = {
  cache: "no-store",
  headers: { Accept: "application/json" },
};

type ProjectionRow = Record<string, unknown>;

export type WeeklyProjectionFetchResult = {
  projections: Map<string, number>;
  positionHints: Map<string, SkillPosition[]>;
  rawPositionHints: Map<string, string | null>;
};

export type ParseProjectionOptions = {
  ppr: PprMode;
  scoringSettings?: Record<string, number>;
};

const rawWeekCache = new Map<string, ProjectionRow[]>();
const parsedWeekCache = new Map<string, WeeklyProjectionFetchResult>();

function rawWeekCacheKey(season: string, week: number): string {
  return `${season}:${week}`;
}

function parsedWeekCacheKey(season: string, week: number, options: ParseProjectionOptions): string {
  return `${season}:${week}:${scoringSettingsCacheKey(options.scoringSettings, options.ppr)}`;
}

function playerIdFromRow(row: ProjectionRow): string | null {
  const id = row.player_id ?? row.playerId;
  if (id == null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

/** Undocumented Sleeper endpoint — weekly NFL player projections. */
export function sleeperWeeklyProjectionsUrl(season: string, week: number): string {
  const q = new URLSearchParams({ season_type: "regular" });
  return `https://api.sleeper.com/projections/nfl/${encodeURIComponent(season)}/${week}?${q.toString()}`;
}

function parseProjectionRows(
  rows: ProjectionRow[],
  options: ParseProjectionOptions,
): WeeklyProjectionFetchResult {
  const projections = new Map<string, number>();
  const positionHints = new Map<string, SkillPosition[]>();
  const rawPositionHints = new Map<string, string | null>();
  const { ppr, scoringSettings } = options;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const playerId = playerIdFromRow(row);
    if (!playerId) continue;

    const pts = fantasyPointsFromProjectionRow(row, scoringSettings, ppr);
    if (pts > 0) projections.set(playerId, pts);

    let skills = skillPositionsFromProjectionRow(row);
    if (skills.length === 0) {
      skills = skillPositionsFromProjectionStats(row);
    }
    if (skills.length > 0) positionHints.set(playerId, skills);

    const raw = rawPositionHintForPlayerId(playerId, rawPositionFromProjectionRow(row));
    if (raw) rawPositionHints.set(playerId, raw);
  }

  return { projections, positionHints, rawPositionHints };
}

function filterProjectionResult(
  full: WeeklyProjectionFetchResult,
  relevantPlayerIds: Set<string>,
): WeeklyProjectionFetchResult {
  const projections = new Map<string, number>();
  const positionHints = new Map<string, SkillPosition[]>();
  const rawPositionHints = new Map<string, string | null>();

  for (const id of relevantPlayerIds) {
    const pts = full.projections.get(id);
    if (pts != null && pts > 0) projections.set(id, pts);
    const skills = full.positionHints.get(id);
    if (skills?.length) positionHints.set(id, skills);
    const raw = full.rawPositionHints.get(id);
    if (raw) rawPositionHints.set(id, raw);
    if (isSleeperTeamDefenseId(id)) rawPositionHints.set(id, "DEF");
  }

  return { projections, positionHints, rawPositionHints };
}

async function fetchRawWeekRows(season: string, week: number): Promise<ProjectionRow[]> {
  const cacheKey = rawWeekCacheKey(season, week);
  const cached = rawWeekCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(sleeperWeeklyProjectionsUrl(season, week), PROJECTION_FETCH_INIT);
  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data) ? (data as ProjectionRow[]) : [];
  rawWeekCache.set(cacheKey, rows);
  return rows;
}

async function fetchFullWeekProjections(
  season: string,
  week: number,
  options: ParseProjectionOptions,
): Promise<WeeklyProjectionFetchResult> {
  const cacheKey = parsedWeekCacheKey(season, week, options);
  const cached = parsedWeekCache.get(cacheKey);
  if (cached) return cached;

  const empty: WeeklyProjectionFetchResult = {
    projections: new Map(),
    positionHints: new Map(),
    rawPositionHints: new Map(),
  };

  const rows = await fetchRawWeekRows(season, week);
  if (!rows.length) return empty;

  const parsed = parseProjectionRows(rows, options);
  parsedWeekCache.set(cacheKey, parsed);
  return parsed;
}

export type FetchWeeklyProjectionsOptions = {
  ppr: PprMode;
  scoringSettings?: Record<string, number>;
  relevantPlayerIds?: Set<string>;
};

export async function fetchSleeperWeeklyProjectionsWithHints(
  season: string,
  week: number,
  pprOrOptions: PprMode | FetchWeeklyProjectionsOptions,
  relevantPlayerIdsLegacy?: Set<string>,
): Promise<WeeklyProjectionFetchResult> {
  const empty: WeeklyProjectionFetchResult = {
    projections: new Map(),
    positionHints: new Map(),
    rawPositionHints: new Map(),
  };

  const options: FetchWeeklyProjectionsOptions =
    typeof pprOrOptions === "number"
      ? { ppr: pprOrOptions, relevantPlayerIds: relevantPlayerIdsLegacy }
      : pprOrOptions;

  try {
    const full = await fetchFullWeekProjections(season, week, {
      ppr: options.ppr,
      scoringSettings: options.scoringSettings,
    });
    if (!options.relevantPlayerIds?.size) return full;
    return filterProjectionResult(full, options.relevantPlayerIds);
  } catch {
    return empty;
  }
}

/** @deprecated Use fetchSleeperWeeklyProjectionsWithHints */
export async function fetchSleeperWeeklyProjections(
  season: string,
  week: number,
  ppr: PprMode,
  relevantPlayerIds?: Set<string>,
): Promise<Map<string, number>> {
  const result = await fetchSleeperWeeklyProjectionsWithHints(season, week, {
    ppr,
    relevantPlayerIds,
  });
  return result.projections;
}

export type ProjectionWeeksParallelResult = {
  byWeek: Map<number, Map<string, number>>;
  mergedPositionHints: Map<string, SkillPosition[]>;
  mergedRawHints: Map<string, string | null>;
};

export type FetchProjectionWeeksOptions = {
  concurrency?: number;
  /** When set, only parse rows for these Sleeper player ids (still downloads full weekly payload). */
  relevantPlayerIds?: Set<string>;
  /** League scoring_settings — projected stats are dot-product scored (Sleeper app parity). */
  scoringSettings?: Record<string, number>;
  ppr?: PprMode;
};

export async function fetchProjectionWeeksParallel(
  weeks: number[],
  season: string,
  pprOrOptions: PprMode | FetchProjectionWeeksOptions = 1,
  optionsLegacy?: FetchProjectionWeeksOptions | number,
): Promise<ProjectionWeeksParallelResult> {
  let options: FetchProjectionWeeksOptions;
  if (typeof pprOrOptions === "number") {
    const legacyConcurrency =
      typeof optionsLegacy === "number" ? optionsLegacy : DEFAULT_PROJECTION_CONCURRENCY;
    const legacyOpts = typeof optionsLegacy === "number" ? undefined : optionsLegacy;
    options = {
      ppr: pprOrOptions,
      concurrency: legacyOpts?.concurrency ?? legacyConcurrency,
      relevantPlayerIds: legacyOpts?.relevantPlayerIds,
      scoringSettings: legacyOpts?.scoringSettings,
    };
  } else {
    options = {
      ppr: pprOrOptions.ppr ?? 1,
      ...pprOrOptions,
    };
  }

  const concurrency = options.concurrency ?? DEFAULT_PROJECTION_CONCURRENCY;
  const ppr = options.ppr ?? 1;

  const byWeek = new Map<number, Map<string, number>>();
  const mergedPositionHints = new Map<string, SkillPosition[]>();
  const mergedRawHints = new Map<string, string | null>();

  if (weeks.length === 0) {
    return { byWeek, mergedPositionHints, mergedRawHints };
  }

  const queue = [...weeks];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const week = queue.shift();
      if (week === undefined) break;
      const result = await fetchSleeperWeeklyProjectionsWithHints(season, week, {
        ppr,
        scoringSettings: options.scoringSettings,
        relevantPlayerIds: options.relevantPlayerIds,
      });
      byWeek.set(week, result.projections);
      for (const [id, positions] of result.positionHints) {
        if (!mergedPositionHints.has(id)) mergedPositionHints.set(id, positions);
      }
      for (const [id, raw] of result.rawPositionHints) {
        if (!mergedRawHints.has(id)) mergedRawHints.set(id, raw);
      }
    }
  });

  await Promise.all(workers);
  return { byWeek, mergedPositionHints, mergedRawHints };
}

export function sumRosterProjectionPoints(
  playerIds: string[] | null | undefined,
  projections: Map<string, number>,
): number {
  if (!playerIds?.length) return 0;
  let total = 0;
  for (const id of playerIds) {
    if (!id) continue;
    const pts = projections.get(id);
    if (pts != null && pts > 0) total += pts;
  }
  return total;
}

/** Sleeper lineup slots for a week (matchup starters, then roster starters). */
export function starterPlayerIds(
  matchupRow: { starters?: string[] } | undefined,
  rosterStarters: string[] | null | undefined,
  rosterPlayers: string[] | null | undefined,
): string[] {
  const fromMatchup = matchupRow?.starters?.filter(Boolean);
  if (fromMatchup?.length) return fromMatchup;
  const fromRoster = rosterStarters?.filter(Boolean);
  if (fromRoster?.length) return fromRoster;
  return rosterPlayers?.filter(Boolean) ?? [];
}

/** @visibleForTesting */
export function clearProjectionWeekCacheForTests(): void {
  rawWeekCache.clear();
  parsedWeekCache.clear();
}
