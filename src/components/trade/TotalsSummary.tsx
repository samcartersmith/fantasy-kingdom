import type { ReactNode } from "react";
import { comparisonVerdict } from "@/lib/trade-evaluation-copy";
import { ComparisonShareBar } from "@/components/trade/ComparisonShareBar";

type Props = {
  total1: number;
  total2: number;
  /** Shown below the verdict when provided (e.g. “Evaluate Trade” when both sides have assets). */
  evaluateAction?: ReactNode;
};

export function TotalsSummary({ total1, total2, evaluateAction }: Props) {
  const verdict = comparisonVerdict(total1, total2);

  return (
    <section
      aria-labelledby="totals-heading"
      className="dash-glass-panel rounded-[var(--dash-radius-md)] p-3 sm:p-4 space-y-2 ring-1 ring-dash-primary/25"
    >
      <h2 id="totals-heading" className="dash-heading-section text-dash-text">
        Comparison
      </h2>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-dash-text/55">Team 1</p>
          <p className="text-xl font-bold font-mono tabular-nums text-dash-text leading-tight">{total1.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-dash-text/55">Team 2</p>
          <p className="text-xl font-bold font-mono tabular-nums text-dash-text leading-tight">{total2.toLocaleString()}</p>
        </div>
      </div>
      <ComparisonShareBar total1={total1} total2={total2} />
      <p className="text-xs text-dash-text/80 leading-snug">{verdict}</p>
      {evaluateAction ? <div className="pt-1">{evaluateAction}</div> : null}
    </section>
  );
}
