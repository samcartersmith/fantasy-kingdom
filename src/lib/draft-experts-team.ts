import type { DraftExpertsPickRow } from "@/lib/draft-experts-build";
import type { StealBustRow } from "@/lib/draft-experts-aggregate";

export type TeamSummary = {
  pickCount: number;
  avgVsSlotRatio: number;
  rank: number | null;
  totalManagers: number;
};

export function filterPicksByRoster(
  picks: DraftExpertsPickRow[],
  rosterId: number,
): DraftExpertsPickRow[] {
  return picks.filter((p) => p.roster_id === rosterId);
}

export function filterStealBustByRoster(rows: StealBustRow[], rosterId: number): StealBustRow[] {
  return rows.filter((r) => r.roster_id === rosterId);
}

export function managerRank(
  effectiveness: { roster_id: number; avgVsSlotRatio: number }[],
  rosterId: number,
): number | null {
  const idx = effectiveness.findIndex((e) => e.roster_id === rosterId);
  return idx >= 0 ? idx + 1 : null;
}

export function teamSummary(
  picks: DraftExpertsPickRow[],
  rosterId: number,
  effectiveness: { roster_id: number; avgVsSlotRatio: number; pickCount: number }[],
): TeamSummary {
  const teamPicks = filterPicksByRoster(picks, rosterId);
  const pickCount = teamPicks.length;
  const avgVsSlotRatio =
    pickCount > 0
      ? Math.round(
          (teamPicks.reduce((sum, p) => sum + p.vsSlotRatio, 0) / pickCount) * 100,
        ) / 100
      : 0;
  const rank = managerRank(effectiveness, rosterId);
  return {
    pickCount,
    avgVsSlotRatio,
    rank,
    totalManagers: effectiveness.length,
  };
}

export function sortedManagers(
  managers: Record<string, { roster_id: number; name: string }>,
): { roster_id: number; name: string }[] {
  return Object.values(managers).sort((a, b) => a.name.localeCompare(b.name));
}
