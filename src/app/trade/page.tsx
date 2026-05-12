import { TradeCalculator } from "@/components/trade/TradeCalculator";

export default function TradePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-dash-text">
          Trade calculator
        </h1>
        <p className="text-sm sm:text-base text-dash-text/70 leading-relaxed">
          Build two sides using Sleeper-backed player rows and heuristic values (search rank + add trending). Superflex
          bumps QB numbers for illustration only — not league-specific scoring.
        </p>
      </header>
      <TradeCalculator />
    </div>
  );
}
