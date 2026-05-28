"use client";

import { useState } from "react";
import { SeasonPredictionsHub } from "@/components/season-predictions/SeasonPredictionsHub";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function SeasonPredictionsPage() {
  const [showPageIntro, setShowPageIntro] = useState(true);

  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12">
      <div className="w-full space-y-8">
        {showPageIntro ? (
          <header className="space-y-3">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-dash-text/65">
              Tools
            </p>
            <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text">
              Season predictions
            </h1>
            <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed max-w-xl">
              Connect Sleeper and simulate the regular season: each matchup compares Sleeper&apos;s
              suggested starter projections week by week (actual scores for completed weeks). See
              projected standings and week-by-week winners.
            </p>
          </header>
        ) : null}
        <SeasonPredictionsHub onShowPageIntroChange={setShowPageIntro} />
      </div>
    </EditorialPageShell>
  );
}
