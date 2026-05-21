"use client";

import { useEffect, useState, type RefObject } from "react";

type Options = {
  minWidth?: number;
};

/**
 * Observes container width for responsive charts. Height is typically derived from row count.
 */
export function useChartSize(
  containerRef: RefObject<HTMLElement | null>,
  options: Options = {}
): { width: number; ready: boolean } {
  const { minWidth = 280 } = options;
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (w: number) => {
      const next = Math.max(minWidth, Math.floor(w));
      setWidth(next);
      setReady(next > 0);
    };

    update(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, minWidth]);

  return { width, ready };
}
