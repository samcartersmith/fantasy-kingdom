"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ConnectBarSelectOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

type Props = {
  id?: string;
  label: string;
  value: string;
  options: ConnectBarSelectOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 text-dash-text/70 motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConnectBarSelect({
  id: idProp,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listboxId = `${id}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.getElementById(listboxId);
      if (menu?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, listboxId]);

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  const menu =
    open && !disabled && options.length > 0 && menuPos ? (
      <ul
        id={listboxId}
        role="listbox"
        aria-label={label}
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 100,
        }}
        className="max-h-60 overflow-y-auto overscroll-contain rounded-[var(--dash-radius-sm)] border border-dash-border bg-dash-surface-elevated py-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <li key={opt.value || "__empty"} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`w-full px-3 py-2.5 text-left text-sm cursor-pointer motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:bg-dash-primary/25 ${
                  isSelected
                    ? "bg-dash-primary/20 text-dash-text font-medium"
                    : "text-dash-text/90 hover:bg-white/8 hover:text-dash-text"
                }`}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className="relative min-w-0 w-full">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={`${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} w-full min-h-9 flex items-center justify-between gap-2 rounded-[2px] text-left text-sm motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent hover:text-dash-text`}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={`min-w-0 truncate ${selected ? "text-dash-text" : "text-dash-text/55"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
