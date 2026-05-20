import { LeaguesHub } from "@/components/leagues/LeaguesHub";

export default function LeaguesPage() {
  return (
    <div className="editorial-page relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <div className="mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="space-y-3 max-w-3xl mb-10">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-home-muted">
            Sleeper sync
          </p>
          <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text">
            Leagues
          </h1>
          <p className="text-sm sm:text-base text-home-muted leading-relaxed max-w-xl">
            Connect a Sleeper dynasty league, select your roster, and get guidance on positional strength,
            trade chips, and roster value rank using the fair-trade model.
          </p>
        </header>
        <LeaguesHub />
      </div>
    </div>
  );
}
