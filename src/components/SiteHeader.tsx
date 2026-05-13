import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-dash-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-dash-text hover:text-dash-primary transition-colors rounded-[var(--dash-radius-sm)] min-h-11 inline-flex items-center"
        >
          Fantasy Kingdom
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6">
          <Link
            href="/rankings"
            className="text-sm font-medium text-dash-text/90 hover:text-dash-primary transition-colors rounded-[var(--dash-radius-sm)] min-h-11 inline-flex items-center"
          >
            Rankings
          </Link>
          <Link
            href="/trade"
            className="text-sm font-medium text-dash-text/90 hover:text-dash-primary transition-colors rounded-[var(--dash-radius-sm)] min-h-11 inline-flex items-center"
          >
            Trade calculator
          </Link>
        </nav>
      </div>
    </header>
  );
}
