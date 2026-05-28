/** 20px stroke icons for tool tiles (white on primary well). */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "text-dash-text",
};

export function TradeCalculatorIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 16V4m0 0L3 8m4-4 4 4" />
      <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}

export function RankingsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19V5" />
      <path d="M10 19V9" />
      <path d="M16 19v-6" />
      <path d="M22 19V3" />
    </svg>
  );
}

export function TeamEvaluationIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function DraftExpertsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function LeagueDataWizardIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6 7.8 7.8" />
      <path d="M16.2 16.2l2.2 2.2" />
      <path d="M5.6 18.4 7.8 16.2" />
      <path d="M16.2 7.8l2.2-2.2" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function NewsRoomIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19h16" />
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

export function MatchupAdviceIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v18" />
      <path d="M5 7h5v3H5z" />
      <path d="M14 7h5v3h-5z" />
      <path d="M5 13h5v4H5z" />
      <path d="M14 13h5v4h-5z" />
    </svg>
  );
}

export function SeasonPredictionsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function ContenderCurveIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 18c4-8 12-8 16-14" />
      <circle cx="18" cy="4" r="2" />
      <path d="M4 20h16" />
    </svg>
  );
}
