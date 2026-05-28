"use client";

import { useCallback, useState } from "react";

type Props = {
  leagueId: string;
  className?: string;
};

export function LeagueIdHint({ leagueId, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(leagueId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [leagueId]);

  return (
    <p className={`text-xs text-dash-text/60 ${className}`.trim()}>
      Sleeper league ID:{" "}
      <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-dash-text/80">
        {leagueId}
      </code>{" "}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="text-dash-primary hover:text-dash-primary/80 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary rounded"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </p>
  );
}
