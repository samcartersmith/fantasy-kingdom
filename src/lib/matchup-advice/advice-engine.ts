import type { GuidanceInsight } from "@/lib/roster-guidance";
import type { LineupAssignment } from "@/lib/season-predictions/lineup-optimizer";
import { slotLabel } from "@/lib/season-predictions/lineup-optimizer";

export type AdvicePlayerLookup = {
  name: (playerId: string) => string;
  injuryBadge: (playerId: string) => string | null;
  isUnavailable: (playerId: string) => boolean;
};

export type BuildAdviceInput = {
  yourRosterId: number;
  yourProjectedTotal: number;
  opponentProjectedTotal: number | null;
  currentAssignments: LineupAssignment[];
  optimalAssignments: LineupAssignment[];
  projections: Map<string, number>;
  playerLookup: AdvicePlayerLookup;
};

function formatPoints(n: number): string {
  return n.toFixed(2);
}

export function winProbabilityFromProjections(yours: number, theirs: number): number | null {
  if (yours <= 0 && theirs <= 0) return null;
  const total = yours + theirs;
  if (total <= 0) return null;
  return Math.round((yours / total) * 1000) / 10;
}

export function buildMatchupAdvice(input: BuildAdviceInput): GuidanceInsight[] {
  const insights: GuidanceInsight[] = [];
  const { projections, playerLookup, currentAssignments, optimalAssignments } = input;

  const swaps: Array<{
    slotLabel: string;
    outId: string;
    inId: string;
    delta: number;
  }> = [];

  for (let i = 0; i < currentAssignments.length; i++) {
    const current = currentAssignments[i]?.playerId ?? null;
    const optimal = optimalAssignments[i]?.playerId ?? null;
    if (!optimal || current === optimal) continue;

    const currentPts = current ? (projections.get(current) ?? 0) : 0;
    const optimalPts = projections.get(optimal) ?? 0;
    const delta = optimalPts - currentPts;
    if (delta <= 0.25) continue;

    swaps.push({
      slotLabel: slotLabel(currentAssignments[i]!.slot),
      outId: current ?? "empty",
      inId: optimal,
      delta,
    });
  }

  swaps.sort((a, b) => b.delta - a.delta);

  for (const swap of swaps.slice(0, 5)) {
    const inName = playerLookup.name(swap.inId);
    const outName =
      swap.outId === "empty" ? "empty slot" : playerLookup.name(swap.outId);
    insights.push({
      id: `swap-${swap.slotLabel}-${swap.inId}`,
      tone: "opportunity",
      title: `Start ${inName} at ${swap.slotLabel}`,
      body: `Projected +${formatPoints(swap.delta)} pts vs ${outName}.`,
    });
  }

  const flagged = new Set<string>();
  for (const { playerId } of currentAssignments) {
    if (!playerId || flagged.has(playerId)) continue;
    flagged.add(playerId);

    const proj = projections.get(playerId) ?? 0;
    const badge = playerLookup.injuryBadge(playerId);
    const unavailable = playerLookup.isUnavailable(playerId);

    if (unavailable || badge) {
      insights.push({
        id: `injury-${playerId}`,
        tone: "caution",
        title: `${playerLookup.name(playerId)} availability concern`,
        body: badge
          ? `Listed as ${badge}. Check status before lock.`
          : "Player status is not Active in Sleeper.",
      });
      continue;
    }

    if (proj <= 0) {
      insights.push({
        id: `bye-${playerId}`,
        tone: "caution",
        title: `${playerLookup.name(playerId)} has no projection`,
        body: "Zero weekly projection usually means bye, out, or missing data. Consider a bench replacement.",
      });
    }
  }

  if (input.opponentProjectedTotal != null) {
    const margin = input.yourProjectedTotal - input.opponentProjectedTotal;
    const winPct = winProbabilityFromProjections(
      input.yourProjectedTotal,
      input.opponentProjectedTotal,
    );
    if (margin > 0) {
      insights.unshift({
        id: "margin-favorite",
        tone: "positive",
        title: `Projected to win by ${formatPoints(margin)} pts`,
        body:
          winPct != null
            ? `Your optimal lineup projects ${formatPoints(input.yourProjectedTotal)} vs ${formatPoints(input.opponentProjectedTotal)} (${winPct}% win probability).`
            : `Your optimal lineup projects ${formatPoints(input.yourProjectedTotal)} vs ${formatPoints(input.opponentProjectedTotal)}.`,
      });
    } else if (margin < 0) {
      insights.unshift({
        id: "margin-underdog",
        tone: "neutral",
        title: `Projected trailing by ${formatPoints(Math.abs(margin))} pts`,
        body:
          winPct != null
            ? `Optimal lineup projects ${formatPoints(input.yourProjectedTotal)} vs ${formatPoints(input.opponentProjectedTotal)} (${winPct}% win probability). Lineup upgrades below can close the gap.`
            : `Optimal lineup projects ${formatPoints(input.yourProjectedTotal)} vs ${formatPoints(input.opponentProjectedTotal)}. Review swap suggestions below.`,
      });
    } else {
      insights.unshift({
        id: "margin-even",
        tone: "neutral",
        title: "Projected even",
        body: "Both teams project to the same optimal lineup total this week.",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "no-changes",
      tone: "positive",
      title: "Lineup looks set",
      body: "No projected upgrades found vs your current starters.",
    });
  }

  return insights;
}
