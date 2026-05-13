import type { CatalogEvaluation } from "@/lib/trade-model/types";

/** One-line summary for catalog rows and roster lines. */
export function formatEvaluationTeaser(ev: CatalogEvaluation): string {
  const skip = new Set(["marketBuzz", "anchor", "fantasyProduction", "superflexQb"]);
  const parts = ev.components.filter((c) => !skip.has(c.key));
  const sorted = [...parts].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = sorted.slice(0, 2).map((c) => {
    const n = Math.round(c.contribution);
    const sign = n >= 0 ? "+" : "";
    const short = c.label.length > 24 ? `${c.label.slice(0, 22)}…` : c.label;
    return `${short} ${sign}${n}`;
  });
  const conf = Math.round(ev.confidence01 * 100);
  const miss = ev.components.filter((c) => c.missing).length;
  const missSuffix = miss ? ` · ${miss} default` : "";
  return `${conf}% data confidence${missSuffix}${top.length ? ` · ${top.join("; ")}` : ""}`;
}
