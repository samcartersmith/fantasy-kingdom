"use client";

type Props = {
  tradedToName: string;
  className?: string;
};

/** Pill showing pick was traded to the drafting team (→ Team). */
export function DraftSlotTradePill({ tradedToName, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 max-w-full rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-black/55 text-dash-text border border-white/15 ${className}`.trim()}
      title={`Traded to ${tradedToName}`}
    >
      <span className="shrink-0 text-dash-primary" aria-hidden>
        →
      </span>
      <span className="truncate">{tradedToName}</span>
    </span>
  );
}
