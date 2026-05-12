type Props = {
  total1: number;
  total2: number;
};

export function TotalsSummary({ total1, total2 }: Props) {
  const delta = total1 - total2;
  const abs = Math.abs(delta);
  let verdict: string;
  if (total1 === 0 && total2 === 0) {
    verdict = "Add assets to each side to compare totals.";
  } else if (abs < 200) {
    verdict = "Roughly even — within a small demo margin.";
  } else if (delta > 0) {
    verdict = `Team 1 is ahead by about ${abs.toLocaleString()} trade points.`;
  } else {
    verdict = `Team 2 is ahead by about ${abs.toLocaleString()} trade points.`;
  }

  const combined = total1 + total2;
  const pct1 = combined === 0 ? 50 : (total1 / combined) * 100;
  const pct2 = combined === 0 ? 50 : (total2 / combined) * 100;

  return (
    <section
      aria-labelledby="totals-heading"
      className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-6 space-y-4 ring-1 ring-dash-primary/25"
    >
      <h2 id="totals-heading" className="text-base font-semibold text-dash-text">
        Comparison
      </h2>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-dash-text/55">Team 1</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-dash-text">{total1.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-dash-text/55">Team 2</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-dash-text">{total2.toLocaleString()}</p>
        </div>
      </div>
      <div
        className="flex h-3 rounded-full overflow-hidden bg-black/40 border border-white/10"
        role="img"
        aria-label={`Team 1 share ${Math.round(pct1)} percent, Team 2 share ${Math.round(pct2)} percent of combined value`}
      >
        <div className="h-full bg-dash-primary transition-all duration-300" style={{ width: `${pct1}%` }} />
        <div className="h-full bg-dash-secondary/90 transition-all duration-300" style={{ width: `${pct2}%` }} />
      </div>
      <p className="text-sm text-dash-text/80">{verdict}</p>
      <p className="text-xs font-mono text-dash-text/50 tabular-nums">
        Raw delta (team 1 − team 2): {delta >= 0 ? "+" : ""}
        {delta.toLocaleString()}
      </p>
    </section>
  );
}
