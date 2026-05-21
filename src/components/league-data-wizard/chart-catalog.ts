import type { LeagueHistoryPayload } from "@/lib/league-history-build";

export type ChartId =
  | "championships"
  | "regularSeasonWins"
  | "allTimePoints"
  | "nuclearWeeks"
  | "playoffAppearances"
  | "firstRoundPicks";

export type ChartDefinition = {
  id: ChartId;
  title: string;
  teaser: string;
  description: string;
  available: (data: LeagueHistoryPayload) => boolean;
};

export const CHART_CATALOG: ChartDefinition[] = [
  {
    id: "championships",
    title: "Championship tally",
    teaser: "Who raised the trophy",
    description:
      "Champions from each season's winners bracket when Sleeper has recorded a final winner.",
    available: (d) => d.charts.championships.length > 0,
  },
  {
    id: "regularSeasonWins",
    title: "Regular season wins",
    teaser: "All-time W column",
    description:
      "Head-to-head regular season wins across every season in the chain (playoff weeks excluded when Sleeper marks them).",
    available: (d) => d.charts.regularSeasonWins.some((r) => r.wins > 0),
  },
  {
    id: "allTimePoints",
    title: "All-time points",
    teaser: "Volume kings",
    description:
      "Total regular-season fantasy points scored by each manager across the full league history.",
    available: (d) => d.charts.allTimePoints.some((r) => r.points > 0),
  },
  {
    id: "nuclearWeeks",
    title: "Nuclear team weeks",
    teaser: "Single-week explosions",
    description:
      "The highest single-week team scores in league history. Sleeper reports team totals per week, not individual player weekly lines.",
    available: (d) => d.charts.nuclearWeeks.length > 0,
  },
  {
    id: "playoffAppearances",
    title: "Playoff appearances",
    teaser: "Bracket regulars",
    description:
      "Seasons where each manager appeared in the winners bracket (one count per season).",
    available: (d) => d.charts.playoffAppearances.some((r) => r.count > 0),
  },
  {
    id: "firstRoundPicks",
    title: "First-round royalty",
    teaser: "Round 1 draft haul",
    description:
      "Total first-round picks held across drafts in the league chain (startup and annual drafts).",
    available: (d) => d.charts.firstRoundPicks.some((r) => r.count > 0),
  },
];

export function firstAvailableChartId(data: LeagueHistoryPayload): ChartId {
  const hit = CHART_CATALOG.find((c) => c.available(data));
  return hit?.id ?? "regularSeasonWins";
}
