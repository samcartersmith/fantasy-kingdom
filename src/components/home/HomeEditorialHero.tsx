import type { ReactNode } from "react";
import Link from "next/link";

const linkArrow = (
  <svg
    aria-hidden
    className="size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative z-10 inline-flex items-center gap-2 min-h-11 text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-home-accent hover:text-dash-text motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14]"
    >
      {children}
      {linkArrow}
    </Link>
  );
}

function StepRow({
  step,
  label,
  title,
  description,
  href,
  linkLabel,
  muted,
  revealDelay,
}: {
  step: string;
  label: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  muted?: boolean;
  revealDelay: string;
}) {
  return (
    <li className={`list-none home-reveal ${revealDelay}`}>
      <div className="home-step-row">
        <div className={`home-step-glyph ${muted ? "home-step-glyph--muted" : ""}`} aria-hidden>
          {step}
        </div>
        <div className="home-step-body">
          <p
            className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-2 ${
              muted ? "text-dash-text/40" : "text-home-accent"
            }`}
          >
            {label}
          </p>
          <h2
            className={`home-editorial-display text-[1.65rem] sm:text-[1.85rem] lg:text-[2rem] leading-tight mb-2 ${
              muted ? "text-dash-text/80" : "text-dash-text"
            }`}
          >
            {title}
          </h2>
          <p className="text-sm sm:text-[0.9375rem] text-home-muted leading-relaxed max-w-md mb-4">
            {description}
          </p>
          {href && linkLabel ? <TextLink href={href}>{linkLabel}</TextLink> : null}
        </div>
      </div>
    </li>
  );
}

export function HomeEditorialHero() {
  return (
    <div className="home-editorial relative py-8 sm:py-12 lg:py-14 xl:py-16">
      <div className="home-hero-grid">
        <header className="home-hero-left">
          <div className="space-y-8 sm:space-y-10 lg:space-y-12">
            <p className="home-reveal text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-home-muted">
              Dynasty tools. Smarter decisions.
            </p>

            <div className="space-y-6 lg:space-y-8 home-reveal home-reveal--delay-1">
              <h1 className="home-editorial-display text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem] xl:text-[4.25rem] leading-[1.04] text-dash-text text-balance max-w-[14ch]">
                Make every move count in dynasty
                <span className="text-home-accent" aria-hidden>
                  .
                </span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-home-muted leading-relaxed max-w-[34ch] lg:max-w-md">
                Powerful tools to evaluate trades, research players, and build a championship roster,
                season after season.
              </p>
            </div>

            <div className="home-reveal home-reveal--delay-2">
              <Link
                href="/tools"
                className="home-cta-primary inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-[var(--dash-radius-sm)] bg-home-accent text-[#050a14] text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-home-accent-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14] focus-visible:ring-home-accent"
              >
                Explore tools
                {linkArrow}
              </Link>
            </div>
          </div>

          <p className="home-hero-trust home-reveal home-reveal--delay-3 flex items-start gap-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-home-muted/90 max-w-md leading-relaxed">
            <svg
              aria-hidden
              className="size-4 shrink-0 mt-px text-home-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
            <span>Trusted by dynasty players building smarter rosters.</span>
          </p>
        </header>

        <div
          id="tools-path"
          className="home-steps home-hero-right"
          aria-label="Fantasy Kingdom tools"
        >
          <ol className="flex flex-col gap-10 sm:gap-12 lg:gap-14 p-0 m-0">
            <StepRow
              step="1"
              label="Trade tools"
              title="Trade calculator"
              description="Compare players and picks, balance values, and confidently evaluate any trade."
              href="/trade"
              linkLabel="Calculate a trade"
              revealDelay="home-reveal--delay-4"
            />

            <StepRow
              step="2"
              label="Player research"
              title="Rankings"
              description="Explore dynasty rankings, tiers, and trending adds to stay ahead in your league."
              href="/rankings"
              linkLabel="View rankings"
              revealDelay="home-reveal--delay-5"
            />

            <StepRow
              step="3"
              label="League tools"
              title="Team evaluation"
              description="Connect Sleeper, rank your roster, and get trade-oriented guidance for your team."
              href="/leagues"
              linkLabel="Evaluate your team"
              revealDelay="home-reveal--delay-6"
            />
          </ol>
        </div>
      </div>
    </div>
  );
}
