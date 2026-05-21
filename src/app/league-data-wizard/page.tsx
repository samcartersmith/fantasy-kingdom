"use client";

import { useState } from "react";
import { LeagueDataWizardHub } from "@/components/league-data-wizard/LeagueDataWizardHub";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function LeagueDataWizardPage() {
  const [showPageIntro, setShowPageIntro] = useState(true);

  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12">
      <div className="w-full space-y-8">
        {showPageIntro ? (
          <header className="space-y-3">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-dash-text/65">
              League lore
            </p>
            <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text">
              League data wizard
            </h1>
            <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed max-w-xl">
              Connect a Sleeper dynasty league and scroll through charts built from your league&apos;s
              real history: titles, wins, points, and the weeks everyone still talks about.
            </p>
          </header>
        ) : null}
        <LeagueDataWizardHub onShowPageIntroChange={setShowPageIntro} />
      </div>
    </EditorialPageShell>
  );
}
