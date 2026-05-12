import { RankingsExplorer } from "@/components/rankings/RankingsExplorer";

export default function RankingsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dash-text">Rankings</h1>
        <p className="text-sm sm:text-base text-dash-text/70 leading-relaxed">
          Positional boards built only from Sleeper&apos;s public player payload and add-trending feed. Values match the
          heuristic used in the trade calculator so both tools stay consistent.
        </p>
      </header>
      <RankingsExplorer />
    </div>
  );
}
