"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  description?: string;
  children: ReactNode;
  panelRef?: RefObject<HTMLDivElement | null>;
  size?: "md" | "lg";
};

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function AccountModalShell({
  open,
  onClose,
  title,
  titleId,
  description,
  children,
  panelRef,
  size = "md",
}: Props) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [open]);

  if (!open) return null;

  const maxWidth = size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="dash-scrollbar fixed inset-0 z-50 overflow-y-auto bg-black/55"
      role="presentation"
      onClick={onClose}
    >
      <div className="min-h-full flex flex-col justify-center py-6 sm:py-8">
        <div
          className={`w-full ${maxWidth} mx-auto px-4 sm:px-6 min-h-0 flex flex-col`}
          onClick={onClose}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-h-[min(94vh,820px)] flex flex-col bg-dash-surface-elevated rounded-[var(--dash-radius-md)] border border-dash-border shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6 border-b border-dash-border">
              <div className="min-w-0 space-y-1">
                <h2 id={titleId} className="dash-heading-section text-dash-text">
                  {title}
                </h2>
                {description ? (
                  <p className="text-sm text-dash-text/75 leading-relaxed">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`${btnPress} shrink-0 -m-2 p-2 rounded-[var(--dash-radius-sm)] text-dash-text/80 hover:text-dash-text hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface`}
              >
                <CloseIcon />
              </button>
            </div>
            <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
