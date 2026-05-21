"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";

export type WizardOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  id: string;
  label: string;
  value: string;
  options: WizardOption[];
  loading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

const rowBase =
  "w-full min-h-11 px-4 py-3 text-left text-sm rounded-[var(--dash-radius-sm)] cursor-pointer motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

function SkeletonRows() {
  return (
    <ul className="space-y-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-11 rounded-[var(--dash-radius-sm)] border border-white/10 bg-white/[0.04] animate-pulse"
        />
      ))}
    </ul>
  );
}

export function WizardOptionList({
  id,
  label,
  value,
  options,
  loading = false,
  emptyMessage,
  disabled = false,
  onChange,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled || loading || options.length === 0) return;
      const currentIndex = options.findIndex((o) => o.value === value);
      let next = currentIndex;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        next = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        next = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = options.length - 1;
      } else {
        return;
      }
      const opt = options[next];
      if (opt) onChange(opt.value);
    },
    [disabled, loading, options, value, onChange],
  );

  if (loading) {
    return (
      <div aria-busy="true" aria-label={`Loading ${label.toLowerCase()}`}>
        <SkeletonRows />
      </div>
    );
  }

  if (options.length === 0) {
    return emptyMessage ? (
      <p className="text-sm text-dash-text/75 leading-relaxed">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className="dash-scrollbar max-h-[min(50vh,20rem)] overflow-y-auto overscroll-contain rounded-[var(--dash-radius-md)] border border-dash-border bg-black/35 divide-y divide-white/10"
      onKeyDown={onKeyDown}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        const optionId = `${id}-${opt.value}`;
        return (
          <button
            key={opt.value}
            type="button"
            id={optionId}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`${rowBase} flex flex-col items-start gap-0.5 ${
              selected
                ? "bg-dash-primary/20 text-dash-text font-medium"
                : "text-dash-text/90 hover:bg-white/8 hover:text-dash-text"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="truncate w-full">{opt.label}</span>
            {opt.hint ? (
              <span className="text-xs font-normal text-dash-text/60 truncate w-full">{opt.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
