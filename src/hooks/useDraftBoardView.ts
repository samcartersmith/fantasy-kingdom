"use client";

import { useCallback, useEffect, useState } from "react";

export type DraftBoardViewMode = "table" | "grid";

const STORAGE_KEY = "fk:draft-experts-board-view";

export function useDraftBoardView(): [DraftBoardViewMode, (mode: DraftBoardViewMode) => void] {
  const [mode, setModeState] = useState<DraftBoardViewMode>("table");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "grid" || stored === "table") setModeState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((next: DraftBoardViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return [mode, setMode];
}
