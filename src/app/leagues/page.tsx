"use client";

import { useState } from "react";
import { LeaguesHub } from "@/components/leagues/LeaguesHub";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function LeaguesPage() {
  const [showPageIntro, setShowPageIntro] = useState(false);

  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12">
      <div className="w-full space-y-8">
        {showPageIntro ? (
          <header className="space-y-3">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-dash-text/65">
              Sleeper sync
            </p>
            <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text">
              Leagues
            </h1>
            <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed max-w-xl">
              Connect a Sleeper dynasty league, select your roster, and get guidance on positional strength,
              trade chips, and roster value rank using the fair-trade model.
            </p>
          </header>
        ) : null}
        <LeaguesHub onShowPageIntroChange={setShowPageIntro} />
      </div>
    </EditorialPageShell>
  );
}
