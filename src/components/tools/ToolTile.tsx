import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  title: string;
  blurb: string;
  icon: ReactNode;
  available: boolean;
};

export function ToolTile({ href, title, blurb, icon, available }: Props) {
  return (
    <Link
      href={href}
      className="group flex min-h-[11rem] flex-col rounded-[var(--dash-radius-md)] border border-dash-border bg-dash-surface-elevated/80 p-5 sm:p-6 motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-150 hover:border-dash-primary/50 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--dash-radius-sm)] bg-dash-primary/90 motion-safe:transition-colors motion-safe:duration-150 group-hover:bg-dash-primary"
          aria-hidden
        >
          {icon}
        </span>
        {!available ? (
          <span className="shrink-0 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-dash-text/65">
            Soon
          </span>
        ) : null}
      </div>
      <h2 className="text-base sm:text-lg font-semibold text-dash-text mb-2 group-hover:text-dash-text">
        {title}
      </h2>
      <p className="text-sm text-dash-text/75 leading-relaxed mt-auto">{blurb}</p>
    </Link>
  );
}
