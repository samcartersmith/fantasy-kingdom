/** Same dual-segment bar as the Comparison card (TotalsSummary). */
export function ComparisonShareBar({
  total1,
  total2,
  className = "",
}: {
  total1: number;
  total2: number;
  /** Extra Tailwind classes on the outer bar (e.g. margin). */
  className?: string;
}) {
  const combined = total1 + total2;
  const pct1 = combined === 0 ? 50 : (total1 / combined) * 100;
  const pct2 = combined === 0 ? 50 : (total2 / combined) * 100;

  return (
    <div
      className={["flex h-2 rounded-full overflow-hidden bg-black/40 border border-white/10", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`Team 1 share ${Math.round(pct1)} percent, Team 2 share ${Math.round(pct2)} percent of combined value`}
    >
      <div className="h-full bg-dash-primary transition-all duration-300" style={{ width: `${pct1}%` }} />
      <div className="h-full bg-dash-secondary/90 transition-all duration-300" style={{ width: `${pct2}%` }} />
    </div>
  );
}
