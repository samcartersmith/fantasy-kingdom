"use client";

type Props = {
  pickedByName?: string;
  isTradedOrProxy: boolean;
  className?: string;
};

export function PickTradeBadge({ pickedByName, isTradedOrProxy, className = "" }: Props) {
  if (!isTradedOrProxy || !pickedByName) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-black/50 text-dash-text/90 border border-white/15 ${className}`.trim()}
      title={`Selection made by ${pickedByName} (traded or proxy pick)`}
    >
      <span aria-hidden>→</span>
      <span className="truncate max-w-[5rem]">{pickedByName}</span>
    </span>
  );
}
