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
import {
  readProjectionRowsFromFs,
  writeProjectionRowsToFs,
} from "@/lib/season-predictions/projection-fs-cache";

const DEFAULT_PROJECTION_CONCURRENCY = 4;

/** Weekly projection payloads are ~7MB — above Next.js Data Cache ~2MB limit. */
const PROJECTION_FETCH_INIT: RequestInit = {
  cache: "no-store",
  headers: { Accept: "application/json" },
};

type ProjectionRow = Record<string, unknown>;

export type ProjectionPlayerMeta = {
  name: string;
  position: string | null;
  nflTeam: string | null;
  opponent: string | null;
  gameDate: string | null;
  injuryBadge: string | null;
  sleeperStatus: string | null;
};

export type WeeklyProjectionFetchResult = {
  projections: Map<string, number>;
  positionHints: Map<string, SkillPosition[]>;
  rawPositionHints: Map<string, string | null>;
  playerMeta: Map<string, ProjectionPlayerMeta>;
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

function projectionPlayerObject(row: ProjectionRow): Record<string, unknown> | null {
  const player = row.player;
  return player && typeof player === "object" ? (player as Record<string, unknown>) : null;
}

function parsePlayerMetaFromRow(row: ProjectionRow): ProjectionPlayerMeta | null {
  const playerId = playerIdFromRow(row);
  if (!playerId) return null;

  const player = projectionPlayerObject(row);
  const first = String(player?.first_name ?? "").trim();
  const last = String(player?.last_name ?? "").trim();
  const name = `${first} ${last}`.trim() || (isSleeperTeamDefenseId(playerId) ? `${playerId} DEF` : `Player ${playerId}`);

  const positionRaw =
    String(player?.position ?? row.position ?? "")
      .trim()
      .toUpperCase() || null;
  const nflTeam =
    String(player?.team ?? row.team ?? "")
      .trim()
      .toUpperCase() || null;
  const opponent = row.opponent != null ? String(row.opponent).trim().toUpperCase() : null;
  const gameDate = row.date != null ? String(row.date).trim() : null;
  const injuryRaw = String(player?.injury_status ?? "").trim();
  const injuryBadge = injuryRaw ? injuryRaw.toUpperCase() : null;
  const sleeperStatus = String(player?.status ?? row.status ?? "").trim() || null;

  return {
    name,
    position: positionRaw,
    nflTeam,
    opponent,
    gameDate,
    injuryBadge,
    sleeperStatus,
  };
}

function emptyProjectionResult(): WeeklyProjectionFetchResult {
  return {
    projections: new Map(),
    positionHints: new Map(),
    rawPositionHints: new Map(),
    playerMeta: new Map(),
  };
}

function parseProjectionRows(
  rows: ProjectionRow[],
  options: ParseProjectionOptions,
  relevantPlayerIds?: Set<string>,
): WeeklyProjectionFetchResult {
  const projections = new Map<string, number>();
  const positionHints = new Map<string, SkillPosition[]>();
  const rawPositionHints = new Map<string, string | null>();
  const playerMeta = new Map<string, ProjectionPlayerMeta>();
  const { ppr, scoringSettings } = options;
  const filterIds = relevantPlayerIds?.size ? relevantPlayerIds : null;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const playerId = playerIdFromRow(row);
    if (!playerId) continue;
    if (filterIds && !filterIds.has(playerId)) continue;

    const meta = parsePlayerMetaFromRow(row);
    if (meta) playerMeta.set(playerId, meta);

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

  if (filterIds) {
    for (const id of filterIds) {
      if (isSleeperTeamDefenseId(id)) rawPositionHints.set(id, "DEF");
    }
  }

  return { projections, positionHints, rawPositionHints, playerMeta };
}

async function fetchRawWeekRows(season: string, week: number): Promise<ProjectionRow[]> {
  const cacheKey = rawWeekCacheKey(season, week);
  const cached = rawWeekCache.get(cacheKey);
  if (cached) return cached;

  const fromFs = readProjectionRowsFromFs(season, week) as ProjectionRow[] | null;
  if (fromFs) {
    rawWeekCache.set(cacheKey, fromFs);
    return fromFs;
  }

  const res = await fetch(sleeperWeeklyProjectionsUrl(season, week), PROJECTION_FETCH_INIT);
  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data) ? (data as ProjectionRow[]) : [];
  rawWeekCache.set(cacheKey, rows);
  writeProjectionRowsToFs(season, week, rows);
  return rows;
}

async function fetchFilteredWeekProjections(
  season: string,
  week: number,
  options: ParseProjectionOptions,
  relevantPlayerIds: Set<string>,
): Promise<WeeklyProjectionFetchResult> {
  const rows = await fetchRawWeekRows(season, week);
  if (!rows.length) return emptyProjectionResult();
  return parseProjectionRows(rows, options, relevantPlayerIds);
}

async function fetchFullWeekProjections(
  season: string,
  week: number,
  options: ParseProjectionOptions,
): Promise<WeeklyProjectionFetchResult> {
  const cacheKey = parsedWeekCacheKey(season, week, options);
  const cached = parsedWeekCache.get(cacheKey);
  if (cached) return cached;

  const empty = emptyProjectionResult();

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

export async function fetchSleeperWeeklyProjectionRows(
  season: string,
  week: number,
): Promise<ProjectionRow[]> {
  return fetchRawWeekRows(season, week);
}

export function parseSleeperWeeklyProjectionsFromRows(
  rows: ProjectionRow[],
  options: FetchWeeklyProjectionsOptions,
  relevantPlayerIds?: Set<string>,
): WeeklyProjectionFetchResult {
  if (!rows.length) return emptyProjectionResult();
  const parseOptions: ParseProjectionOptions = {
    ppr: options.ppr,
    scoringSettings: options.scoringSettings,
  };
  if (relevantPlayerIds?.size) {
    return parseProjectionRows(rows, parseOptions, relevantPlayerIds);
  }
  return parseProjectionRows(rows, parseOptions);
}

export async function fetchSleeperWeeklyProjectionsWithHints(
  season: string,
  week: number,
  pprOrOptions: PprMode | FetchWeeklyProjectionsOptions,
  relevantPlayerIdsLegacy?: Set<string>,
): Promise<WeeklyProjectionFetchResult> {
  const empty = emptyProjectionResult();

  const options: FetchWeeklyProjectionsOptions =
    typeof pprOrOptions === "number"
      ? { ppr: pprOrOptions, relevantPlayerIds: relevantPlayerIdsLegacy }
      : pprOrOptions;

  try {
    const parseOptions = {
      ppr: options.ppr,
      scoringSettings: options.scoringSettings,
    };
    if (options.relevantPlayerIds?.size) {
      return await fetchFilteredWeekProjections(season, week, parseOptions, options.relevantPlayerIds);
    }
    return await fetchFullWeekProjections(season, week, parseOptions);
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

/** Warm raw weekly projection downloads into the in-process cache (no full parse). */
export async function prefetchProjectionWeekRows(season: string, weeks: number[]): Promise<void> {
  const uniqueWeeks = [...new Set(weeks.filter((w) => Number.isFinite(w) && w >= 1))];
  await Promise.all(uniqueWeeks.map((week) => fetchRawWeekRows(season, week)));
}

/** @visibleForTesting */
export function clearProjectionWeekCacheForTests(): void {
  rawWeekCache.clear();
  parsedWeekCache.clear();
}
