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
          Build two sides using Sleeper-backed player rows and heuristic values (search rank + add trending). Superflex
          bumps QB numbers for illustration only — not league-specific scoring.
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
          (cached ~24h). Trade values use the same Sleeper-derived heuristic as{" "}
          <Link href="/rankings" className="text-dash-primary hover:underline">
            rankings
          </Link>{" "}
          (search rank + trending adds — not a market dollar).
        </p>
      </footer>
    </div>
  );
}
