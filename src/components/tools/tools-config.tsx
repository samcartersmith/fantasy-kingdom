import type { ReactNode } from "react";
import {
  DraftExpertsIcon,
  LeagueDataWizardIcon,
  NewsRoomIcon,
  RankingsIcon,
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
    blurb: "Analyst-style draft takes and class notes (coming soon).",
    href: "/draft-experts",
    available: false,
    icon: <DraftExpertsIcon />,
  },
  {
    id: "league-data-wizard",
    title: "League data wizard",
    blurb: "Import league settings and roster context in guided steps (coming soon).",
    href: "/league-data-wizard",
    available: false,
    icon: <LeagueDataWizardIcon />,
  },
  {
    id: "news-room",
    title: "News room",
    blurb: "Curated dynasty headlines and roster-relevant updates (coming soon).",
    href: "/news-room",
    available: false,
    icon: <NewsRoomIcon />,
  },
];
