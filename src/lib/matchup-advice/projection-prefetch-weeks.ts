import type { SleeperNflState } from "@/lib/season-predictions/nfl-state";

function regularSeasonCap(regularSeasonWeeks: number): number {
  return Math.max(1, regularSeasonWeeks);
}

/**
 * Weeks users can select in matchup advice.
 * Offseason (NFL week 0): 1–3. In season: current NFL week and the following week.
 */
export function matchupAdviceAvailableWeeks(
  nflState: SleeperNflState | null,
  regularSeasonWeeks: number,
): number[] {
  const cap = regularSeasonCap(regularSeasonWeeks);

  if (nflState?.week === 0) {
    return [1, 2, 3].filter((w) => w <= cap);
  }

  const current = Math.max(1, Math.min(cap, nflState?.week ?? 1));
  const weeks = [current];
  if (current + 1 <= cap) weeks.push(current + 1);
  return weeks;
}

export function matchupAdviceDefaultWeek(
  nflState: SleeperNflState | null,
  regularSeasonWeeks: number,
): number {
  const available = matchupAdviceAvailableWeeks(nflState, regularSeasonWeeks);
  return available[0] ?? 1;
}

export function isMatchupAdviceWeekAllowed(
  nflState: SleeperNflState | null,
  week: number,
  regularSeasonWeeks: number,
): boolean {
  return matchupAdviceAvailableWeeks(nflState, regularSeasonWeeks).includes(week);
}

export function matchupAdviceWeekScopeNote(nflState: SleeperNflState | null): string {
  if (nflState?.week === 0) {
    return "Offseason: showing weeks 1–3 with early projection data.";
  }
  return "In season: showing the current NFL week and next week only.";
}

export function matchupAdviceWeekSelectOptions(
  nflState: SleeperNflState | null,
  regularSeasonWeeks: number,
): { value: string; label: string }[] {
  const nflWeek = nflState?.week ?? 0;
  return matchupAdviceAvailableWeeks(nflState, regularSeasonWeeks).map((w) => {
    if (nflWeek > 0 && w === nflWeek) {
      return { value: String(w), label: `Week ${w} (current)` };
    }
    if (nflWeek === 0) {
      return { value: String(w), label: `Week ${w} (preseason)` };
    }
    return { value: String(w), label: `Week ${w}` };
  });
}

/**
 * Weeks whose raw projection files should be warmed after a matchup-advice response.
 * Offseason (NFL week 0): weeks 1–3 only. In season: one week ahead of the viewed week.
 */
export function matchupAdviceProjectionPrefetchWeeks(
  nflState: SleeperNflState | null,
  viewedWeek: number,
  regularSeasonWeeks: number,
): number[] {
  const cap = regularSeasonCap(regularSeasonWeeks);

  if (nflState?.week === 0) {
    return [1, 2, 3].filter((w) => w >= 1 && w <= cap);
  }

  const nextWeek = viewedWeek + 1;
  if (nextWeek >= 1 && nextWeek <= cap) {
    return [nextWeek];
  }

  return [];
}
