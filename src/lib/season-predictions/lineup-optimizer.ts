import type { SkillPosition } from "@/lib/sleeper-ranking";

/** Sleeper `roster_positions` tokens that are not starting lineup slots. */
const NON_STARTING = new Set([
  "BN",
  "IR",
  "IR+",
  "TAXI",
  "RESERVE",
  "COV",
]);

export type LineupSlot =
  | { kind: "QB" }
  | { kind: "RB" }
  | { kind: "WR" }
  | { kind: "TE" }
  | { kind: "FLEX" }
  | { kind: "WRRB_FLEX" }
  | { kind: "REC_FLEX" }
  | { kind: "SUPER_FLEX" }
  | { kind: "K" }
  | { kind: "DEF" }
  | { kind: "IDP" };

export type LineupPlayer = {
  playerId: string;
  points: number;
  positions: SkillPosition[];
  rawPosition: string | null;
};

function normalizeToken(p: string): string {
  return p.trim().toUpperCase();
}

function slotFromToken(token: string): LineupSlot | null {
  switch (token) {
    case "QB":
      return { kind: "QB" };
    case "RB":
      return { kind: "RB" };
    case "WR":
      return { kind: "WR" };
    case "TE":
      return { kind: "TE" };
    case "FLEX":
      return { kind: "FLEX" };
    case "WRRB_FLEX":
      return { kind: "WRRB_FLEX" };
    case "REC_FLEX":
      return { kind: "REC_FLEX" };
    case "SUPER_FLEX":
    case "QB_FLEX":
      return { kind: "SUPER_FLEX" };
    case "K":
      return { kind: "K" };
    case "DEF":
    case "DST":
      return { kind: "DEF" };
    case "DL":
    case "LB":
    case "DB":
    case "IDP_FLEX":
      return { kind: "IDP" };
    default:
      return null;
  }
}

export const WEAK_STARTER_THRESHOLD = 6;

export type SlotAlignedStarter = {
  slot: LineupSlot;
  playerId: string | null;
};

/**
 * Pair each starting `roster_positions` slot with the parallel `starters` entry (preserves nulls).
 */
export function zipSlotAlignedStarters(
  rosterPositions: string[] | null | undefined,
  starters: (string | null)[] | null | undefined,
): SlotAlignedStarter[] {
  const out: SlotAlignedStarter[] = [];
  if (!rosterPositions?.length) return out;

  for (let i = 0; i < rosterPositions.length; i++) {
    const token = normalizeToken(rosterPositions[i]!);
    if (!token || NON_STARTING.has(token)) continue;
    const slot = slotFromToken(token);
    if (!slot) continue;

    const rawId = starters?.[i];
    const playerId =
      rawId != null && String(rawId).trim() !== "" && String(rawId) !== "0"
        ? String(rawId).trim()
        : null;
    out.push({ slot, playerId });
  }
  return out;
}

function toLineupPlayer(
  playerId: string,
  projections: Map<string, number>,
  positionLookup: Map<string, SkillPosition[]>,
  rawPositionLookup: Map<string, string | null>,
): LineupPlayer {
  return {
    playerId,
    points: projections.get(playerId) ?? 0,
    positions: positionLookup.get(playerId) ?? [],
    rawPosition: rawPositionLookup.get(playerId) ?? null,
  };
}

function bestBenchPlayerForSlot(
  slot: LineupSlot,
  rosterPlayers: string[],
  used: Set<string>,
  projections: Map<string, number>,
  positionLookup: Map<string, SkillPosition[]>,
  rawPositionLookup: Map<string, string | null>,
): string | null {
  let bestId: string | null = null;
  let bestPts = -1;

  for (const id of rosterPlayers) {
    if (!id || used.has(id)) continue;
    const player = toLineupPlayer(id, projections, positionLookup, rawPositionLookup);
    if (!playerEligibleForSlot(player, slot)) continue;
    const pts = player.points;
    if (pts > bestPts) {
      bestPts = pts;
      bestId = id;
    }
  }

  return bestId;
}

/**
 * Fast lineup: slot-aligned Sleeper starters, fill empty slots, one-pass upgrade if starter projects below threshold.
 */
export function pragmaticProjectedLineupScore(
  rosterPositions: string[] | null | undefined,
  slotStarters: (string | null)[] | null | undefined,
  rosterPlayers: string[] | null | undefined,
  projections: Map<string, number>,
  positionLookup: Map<string, SkillPosition[]>,
  rawPositionLookup: Map<string, string | null> = new Map(),
): number {
  const aligned = zipSlotAlignedStarters(rosterPositions, slotStarters);
  if (!aligned.length) return 0;

  const pool = (rosterPlayers ?? []).filter((id): id is string => Boolean(id));
  const used = new Set<string>();
  const assignments: { slot: LineupSlot; playerId: string | null }[] = aligned.map(
    ({ slot, playerId }) => ({ slot, playerId }),
  );

  // Bye/out: zero weekly projection → treat as empty so bench/optimal swaps can fill the slot.
  for (const assignment of assignments) {
    if (!assignment.playerId) continue;
    const pts = projections.get(assignment.playerId) ?? 0;
    if (pts <= 0) assignment.playerId = null;
  }

  // Honor Sleeper's slot list, but only count legal, unique starters (illegal/duplicate → empty slot).
  for (const assignment of assignments) {
    if (!assignment.playerId) continue;
    const player = toLineupPlayer(
      assignment.playerId,
      projections,
      positionLookup,
      rawPositionLookup,
    );
    if (used.has(assignment.playerId) || !playerEligibleForSlot(player, assignment.slot)) {
      assignment.playerId = null;
      continue;
    }
    used.add(assignment.playerId);
  }

  for (const assignment of assignments) {
    if (assignment.playerId) continue;
    const fill = bestBenchPlayerForSlot(
      assignment.slot,
      pool,
      used,
      projections,
      positionLookup,
      rawPositionLookup,
    );
    if (fill) {
      assignment.playerId = fill;
      used.add(fill);
    }
  }

  for (const assignment of assignments) {
    if (!assignment.playerId) continue;
    const currentPts = projections.get(assignment.playerId) ?? 0;
    if (currentPts >= WEAK_STARTER_THRESHOLD) continue;

    const upgrade = bestBenchPlayerForSlot(
      assignment.slot,
      pool,
      used,
      projections,
      positionLookup,
      rawPositionLookup,
    );
    if (!upgrade) continue;

    const upgradePts = projections.get(upgrade) ?? 0;
    if (upgradePts > currentPts) {
      used.delete(assignment.playerId);
      used.add(upgrade);
      assignment.playerId = upgrade;
    }
  }

  let total = 0;
  for (const { playerId } of assignments) {
    if (playerId) total += projections.get(playerId) ?? 0;
  }
  return total;
}

/** Starting slots from Sleeper league settings (bench/IR/taxi excluded). */
export function parseStartingSlots(rosterPositions: string[] | null | undefined): LineupSlot[] {
  if (!rosterPositions?.length) return [];
  const slots: LineupSlot[] = [];
  for (const raw of rosterPositions) {
    const token = normalizeToken(raw);
    if (!token || NON_STARTING.has(token)) continue;
    const slot = slotFromToken(token);
    if (slot) slots.push(slot);
  }
  return slots;
}

function hasSkill(positions: SkillPosition[], ...want: SkillPosition[]): boolean {
  return want.some((p) => positions.includes(p));
}

export function playerEligibleForSlot(
  player: LineupPlayer,
  slot: LineupSlot,
): boolean {
  switch (slot.kind) {
    case "QB":
      return hasSkill(player.positions, "QB");
    case "RB":
      return hasSkill(player.positions, "RB");
    case "WR":
      return hasSkill(player.positions, "WR");
    case "TE":
      return hasSkill(player.positions, "TE");
    case "FLEX":
      return hasSkill(player.positions, "RB", "WR", "TE");
    case "WRRB_FLEX":
      return hasSkill(player.positions, "RB", "WR");
    case "REC_FLEX":
      return hasSkill(player.positions, "WR", "TE");
    case "SUPER_FLEX":
      return hasSkill(player.positions, "QB", "RB", "WR", "TE");
    case "K":
      return player.rawPosition === "K";
    case "DEF":
      return player.rawPosition === "DEF" || player.rawPosition === "DST";
    case "IDP":
      return false;
    default:
      return false;
  }
}

/** Restrictive slots first so DFS prunes earlier. */
function slotSortKey(slot: LineupSlot): number {
  switch (slot.kind) {
    case "QB":
      return 0;
    case "TE":
      return 1;
    case "K":
      return 2;
    case "DEF":
      return 3;
    case "RB":
      return 4;
    case "WR":
      return 5;
    case "REC_FLEX":
      return 6;
    case "WRRB_FLEX":
      return 7;
    case "FLEX":
      return 8;
    case "SUPER_FLEX":
      return 9;
    case "IDP":
      return 10;
    default:
      return 11;
  }
}

function buildLineupPlayers(
  rosterPlayerIds: string[] | null | undefined,
  projections: Map<string, number>,
  positionLookup: Map<string, SkillPosition[]>,
  rawPositionLookup: Map<string, string | null>,
): LineupPlayer[] {
  if (!rosterPlayerIds?.length) return [];
  const out: LineupPlayer[] = [];
  for (const playerId of rosterPlayerIds) {
    if (!playerId) continue;
    const positions = positionLookup.get(playerId) ?? [];
    const rawPosition = rawPositionLookup.get(playerId) ?? null;
    const points = projections.get(playerId) ?? 0;
    if (points <= 0) continue;
    out.push({
      playerId,
      points,
      positions,
      rawPosition,
    });
  }
  return out;
}

function assignLineupDfs(
  slots: LineupSlot[],
  players: LineupPlayer[],
  slotIndex: number,
  used: Set<string>,
): number {
  if (slotIndex >= slots.length) return 0;

  const slot = slots[slotIndex]!;
  let best = assignLineupDfs(slots, players, slotIndex + 1, used);

  const candidates = players
    .filter((p) => !used.has(p.playerId) && playerEligibleForSlot(p, slot))
    .sort((a, b) => b.points - a.points);

  for (const p of candidates) {
    used.add(p.playerId);
    const total = p.points + assignLineupDfs(slots, players, slotIndex + 1, used);
    if (total > best) best = total;
    used.delete(p.playerId);
  }

  return best;
}

/**
 * Maximize sum of weekly Sleeper projections for a legal starting lineup.
 * Candidates are all `rosterPlayerIds`; unfilled or IDP slots contribute 0.
 */
export function optimizeProjectedLineupScore(
  rosterPlayerIds: string[] | null | undefined,
  projections: Map<string, number>,
  startingSlots: LineupSlot[],
  positionLookup: Map<string, SkillPosition[]>,
  rawPositionLookup: Map<string, string | null> = new Map(),
): number {
  if (!startingSlots.length) {
    return 0;
  }

  const players = buildLineupPlayers(
    rosterPlayerIds,
    projections,
    positionLookup,
    rawPositionLookup,
  );
  if (!players.length) return 0;

  const orderedSlots = [...startingSlots].sort(
    (a, b) => slotSortKey(a) - slotSortKey(b),
  );

  return assignLineupDfs(orderedSlots, players, 0, new Set());
}
