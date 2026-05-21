"use client";

import { useId, type ReactNode, type RefObject } from "react";

type Props = {
  containerRef: RefObject<HTMLDivElement | null>;
  titleId?: string;
  ariaLabel?: string;
  minHeight?: number;
  children: ReactNode;
};

export function ChartContainer({
  containerRef,
  titleId,
  ariaLabel,
  minHeight = 120,
  children,
}: Props) {
  const fallbackId = useId();
  const labelledBy = titleId ?? undefined;

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ minHeight }}
      role="img"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={labelledBy ? undefined : fallbackId}
    >
      {children}
      {!labelledBy && ariaLabel ? (
        <span id={fallbackId} className="sr-only">
          {ariaLabel}
        </span>
      ) : null}
    </div>
  );
}
