import Link from "next/link";
import { TradeCalculator } from "@/components/trade/TradeCalculator";

export default function TradePage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dash-text">
          Trade calculator
        </h1>
      </header>
      <TradeCalculator />
      <footer className="max-w-3xl space-y-3 pt-2">
        <p className="text-sm sm:text-base text-dash-text/70 leading-relaxed">
          Player trade points are led by recent fantasy scoring (a Sleeper stat snapshot; run{" "}
          <code className="text-[11px] bg-black/30 px-1 rounded">npm run data:fantasy</code> to refresh), with smaller
          nudges for games played, curated team and OC tiers, optional role and injury rows, age, league format, and a
          capped Sleeper buzz tweak. Picks use local anchors plus class strength and time discounting. Nothing here is a
          market dollar or official Sleeper trade value. Step-by-step methodology:{" "}
          <code className="text-[11px] bg-black/30 px-1 rounded break-all">docs/how-player-trade-score-is-calculated.md</code>
          .
        </p>
        <p className="text-xs text-dash-text/55 leading-relaxed">
          Players and teams come from the{" "}
          <a
            href="https://docs.sleeper.com"
            className="text-dash-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Sleeper API
          </a>{" "}
          (cached ~24h). Rankings at{" "}
          <Link href="/rankings" className="text-dash-primary hover:underline">
            /rankings
          </Link>{" "}
          still use the Sleeper-only heuristic; the trade catalog uses the fair-trade model unless you call{" "}
          <code className="text-[11px] bg-black/30 px-1 rounded">/api/trade-catalog?legacy=1</code>.
        </p>
      </footer>
    </div>
  );
}
