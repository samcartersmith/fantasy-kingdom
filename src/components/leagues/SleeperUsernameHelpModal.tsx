"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, type RefObject } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
};

const btnPress =
  "cursor-pointer motion-safe:transition motion-safe:duration-150 motion-safe:active:scale-[0.97]";

const frameClass =
  "rounded-[var(--dash-radius-sm)] border border-dash-border bg-black/20 overflow-hidden";

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

const STEPS = [
  {
    id: "app-profile",
    title: "In the Sleeper app",
    body: "Open your league, tap your avatar in the top corner, then open Profile. Your username is the handle under your display name — not your team name.",
    imageSrc: "/help/sleeper-username-app.png",
    imageAlt: "Sleeper mobile profile screen with username highlighted below the display name",
  },
  {
    id: "web-account",
    title: "On sleeper.com",
    body: "Log in, click your avatar in the top-right, and choose Account. Your username is listed in your account details — use that exact handle in the connect field.",
    imageSrc: "/help/sleeper-username-web.png",
    imageAlt: "Sleeper website account menu with username shown in profile details",
  },
] as const;

export function SleeperUsernameHelpModal({ open, onClose, panelRef }: Props) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dash-scrollbar fixed inset-0 z-50 overflow-y-auto bg-black/55"
      role="presentation"
      onClick={onClose}
    >
      <div className="min-h-full flex flex-col justify-center py-6 sm:py-8 lg:py-10">
        <div
          className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 min-h-0 flex flex-col"
          onClick={onClose}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sleeper-username-help-title"
            className="w-full min-h-[min(80vh,640px)] max-h-[min(94vh,920px)] flex flex-col bg-dash-surface-elevated rounded-[var(--dash-radius-md)] border border-dash-border shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-6 pb-5 sm:px-8 sm:pt-8 border-b border-dash-border">
              <div className="min-w-0 space-y-2">
                <h2 id="sleeper-username-help-title" className="dash-heading-section text-dash-text">
                  Find your Sleeper username
                </h2>
                <p className="text-sm sm:text-base text-dash-text/75 leading-relaxed max-w-prose">
                  Use your Sleeper handle (for example{" "}
                  <span className="font-mono text-dash-text/90">dynastyking</span>), not your fantasy team
                  name.
                </p>
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

            <div
              ref={scrollBodyRef}
              className="dash-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8 space-y-10 sm:space-y-12"
            >
              {STEPS.map((step, index) => (
                <section key={step.id} aria-labelledby={`${step.id}-title`} className="space-y-4 sm:space-y-5">
                  <div className="flex items-baseline gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dash-primary/25 text-sm font-bold text-dash-primary">
                      {index + 1}
                    </span>
                    <h3 id={`${step.id}-title`} className="dash-heading-subsection text-dash-text">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm sm:text-base text-dash-text/80 leading-relaxed pl-10">{step.body}</p>
                  <div className="pl-10 pt-1">
                    <div className={frameClass}>
                      <Image
                        src={step.imageSrc}
                        alt={step.imageAlt}
                        width={640}
                        height={400}
                        className="w-full h-auto"
                        sizes="(max-width: 896px) 100vw, 640px"
                      />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
