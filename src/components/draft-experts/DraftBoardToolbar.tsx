"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DraftBoardViewMode } from "@/hooks/useDraftBoardView";

const selectClass =
  "w-full min-h-11 rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/35 px-3 py-2 text-sm text-dash-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

const menuBtnClass =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface inline-flex items-center justify-center min-h-11 min-w-11 rounded-[var(--dash-radius-sm)] border border-white/15 bg-black/25 text-dash-text/90 hover:bg-white/10 hover:border-white/25 hover:text-dash-text";

type Props = {
  seasons: string[];
  selectedSeason: string;
  onSeasonChange: (season: string) => void;
  viewMode: DraftBoardViewMode;
  onViewModeChange: (mode: DraftBoardViewMode) => void;
};

export function DraftBoardToolbar({
  seasons,
  selectedSeason,
  onSeasonChange,
  viewMode,
  onViewModeChange,
}: Props) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="flex-1 sm:w-40">
          <label htmlFor="draft-year-select" className="sr-only">
            Draft year
          </label>
          <select
            id="draft-year-select"
            className={selectClass}
            value={selectedSeason}
            onChange={(e) => onSeasonChange(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s} season
              </option>
            ))}
          </select>
        </div>
        <div className="relative shrink-0" ref={wrapRef}>
          <button
            type="button"
            className={`${menuBtnClass} ${menuOpen ? "motion-safe:rotate-90" : ""}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            title="Board view settings"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="sr-only">Board view settings</span>
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-[var(--dash-radius-sm)] border border-dash-border bg-dash-surface-elevated py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === "table"}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-white/8 ${
                  viewMode === "table" ? "text-dash-primary font-medium" : "text-dash-text"
                }`}
                onClick={() => {
                  onViewModeChange("table");
                  setMenuOpen(false);
                }}
              >
                Table
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={viewMode === "grid"}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-white/8 ${
                  viewMode === "grid" ? "text-dash-primary font-medium" : "text-dash-text"
                }`}
                onClick={() => {
                  onViewModeChange("grid");
                  setMenuOpen(false);
                }}
              >
                Grid
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
