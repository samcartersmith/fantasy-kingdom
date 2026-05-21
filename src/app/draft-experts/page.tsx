"use client";

import { useState } from "react";
import { DraftExpertsHub } from "@/components/draft-experts/DraftExpertsHub";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function DraftExpertsPage() {
  const [showPageIntro, setShowPageIntro] = useState(true);

  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12">
      <div className="w-full space-y-8">
        {showPageIntro ? (
          <header className="space-y-3">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-dash-text/65">
              Draft room
            </p>
            <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text">
              Draft experts
            </h1>
            <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed max-w-xl">
              Connect Sleeper, skip the startup mega-draft, and see who wins on draft day: manager
              grades, year-by-year boards, steals, and busts.
            </p>
          </header>
        ) : null}
        <DraftExpertsHub onShowPageIntroChange={setShowPageIntro} />
      </div>
    </EditorialPageShell>
  );
}
