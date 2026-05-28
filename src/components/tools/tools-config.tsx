import type { ReactNode } from "react";
import {
  ContenderCurveIcon,
  DraftExpertsIcon,
  LeagueDataWizardIcon,
  MatchupAdviceIcon,
  NewsRoomIcon,
  RankingsIcon,
  SeasonPredictionsIcon,
  TeamEvaluationIcon,
  TradeCalculatorIcon,
} from "@/components/tools/tool-icons";

export type ToolEntry = {
  id: string;
  title: string;
  /** Max 15 words */
  blurb: string;
  href: string;
  available: boolean;
  icon: ReactNode;
};

export const TOOLS: ToolEntry[] = [
  {
    id: "trade-calculator",
    title: "Trade calculator",
    blurb: "Compare players and picks; get a fairness read on any dynasty deal.",
    href: "/trade",
    available: true,
    icon: <TradeCalculatorIcon />,
  },
  {
    id: "rankings",
    title: "Rankings",
    blurb: "Sleeper-based positional boards with heuristic values aligned to the calculator.",
    href: "/rankings",
    available: true,
    icon: <RankingsIcon />,
  },
  {
    id: "team-evaluation",
    title: "Team evaluation",
    blurb: "Connect Sleeper, rank your roster, and see trade-oriented guidance.",
    href: "/leagues",
    available: true,
    icon: <TeamEvaluationIcon />,
  },
  {
    id: "draft-experts",
    title: "Draft experts",
    blurb: "Grade dynasty drafts: manager effectiveness, boards by year, steals, and busts.",
    href: "/draft-experts",
    available: true,
    icon: <DraftExpertsIcon />,
  },
  {
    id: "league-data-wizard",
    title: "League data wizard",
    blurb: "Connect Sleeper and explore charts from your league's history across seasons.",
    href: "/league-data-wizard",
    available: true,
    icon: <LeagueDataWizardIcon />,
  },
  {
    id: "news-room",
    title: "News room",
    blurb: "Curated dynasty headlines, Sleeper momentum, and league signals.",
    href: "/news-room",
    available: true,
    icon: <NewsRoomIcon />,
  },
  {
    id: "matchup-advice",
    title: "Matchup advice",
    blurb: "Weekly start/sit calls, lineup leverage, and opponent edges before Sleeper lock.",
    href: "/matchup-advice",
    available: false,
    icon: <MatchupAdviceIcon />,
  },
  {
    id: "season-predictions",
    title: "Season predictions",
    blurb: "Win totals, playoff odds, and roster trajectory before the season starts.",
    href: "/season-predictions",
    available: true,
    icon: <SeasonPredictionsIcon />,
  },
  {
    id: "contender-curve",
    title: "The contender curve",
    blurb: "See when your roster peaks and how to time win-now versus rebuild moves.",
    href: "/contender-curve",
    available: false,
    icon: <ContenderCurveIcon />,
  },
];
