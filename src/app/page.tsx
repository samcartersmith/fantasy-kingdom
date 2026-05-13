import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 md:auto-rows-[minmax(140px,auto)]">
        <section className="md:col-span-4 md:row-span-2 flex flex-col justify-between gap-6 dash-glass-panel rounded-[var(--dash-radius-md)] p-6 sm:p-8 min-h-[220px]">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-dash-text/55">Dynasty playground</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dash-text leading-tight">
              Fantasy Kingdom
            </h1>
            <p className="text-sm sm:text-base text-dash-text/75 max-w-xl leading-relaxed">
              A focused home for dynasty decisions — trade calculator and Sleeper-based rankings today; leagues still
              on the roadmap.
            </p>
          </div>
          <div>
            <Link
              href="/trade"
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text text-sm font-semibold shadow-lg shadow-black/30 hover:bg-dash-primary/90 cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface focus-visible:ring-dash-primary"
            >
              Open trade calculator
            </Link>
          </div>
        </section>

        <section className="md:col-span-2 dash-glass-panel rounded-[var(--dash-radius-md)] p-5 flex flex-col justify-between gap-3 min-h-[140px]">
          <h2 className="text-lg font-semibold text-dash-text">Trade calculator</h2>
          <p className="text-sm text-dash-text/65 flex-1">
            Two sides, running totals, and a simple fairness read — built for quick what-if trades.
          </p>
          <Link
            href="/trade"
            className="text-sm font-semibold text-dash-primary hover:underline rounded-[var(--dash-radius-sm)] w-fit min-h-11 inline-flex items-center"
          >
            Go to tool →
          </Link>
        </section>

        <section className="md:col-span-3 dash-glass-panel rounded-[var(--dash-radius-md)] p-5 flex flex-col justify-between gap-3 min-h-[120px]">
          <h2 className="text-lg font-semibold text-dash-text">Dynasty rankings</h2>
          <p className="text-sm text-dash-text/60 flex-1">
            Positional boards from Sleeper search and add-trending signals — same heuristic as trade values.
          </p>
          <Link
            href="/rankings"
            className="text-sm font-semibold text-dash-primary hover:underline rounded-[var(--dash-radius-sm)] w-fit min-h-11 inline-flex items-center"
          >
            View rankings →
          </Link>
        </section>

        <section className="md:col-span-3 dash-glass-panel rounded-[var(--dash-radius-md)] border-dashed border-white/15 p-5 flex flex-col gap-2 min-h-[120px]">
          <h2 className="text-lg font-semibold text-dash-text/90">Leagues</h2>
          <p className="text-sm text-dash-text/55">Coming later — create a league hub and sync trades.</p>
        </section>
      </div>
    </div>
  );
}
