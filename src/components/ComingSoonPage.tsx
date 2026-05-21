import Link from "next/link";

type ComingSoonPageProps = {
  title: string;
  description: string;
  relatedHref?: { href: string; label: string };
};

export function ComingSoonPage({ title, description, relatedHref }: ComingSoonPageProps) {
  return (
    <div className="max-w-2xl">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-home-muted mb-6">
        Coming soon
      </p>
      <h1 className="home-editorial-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] leading-[1.08] text-dash-text mb-5">
        {title}
      </h1>
      <p className="text-base sm:text-lg text-home-muted leading-relaxed mb-8">{description}</p>
      {relatedHref ? (
        <p className="text-sm text-home-muted mb-8">
          In the meantime, try{" "}
          <Link href={relatedHref.href} className="text-home-accent font-semibold hover:text-dash-text">
            {relatedHref.label}
          </Link>
          .
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/tools"
          className="inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] border border-white/20 text-[11px] font-bold uppercase tracking-[0.12em] text-dash-text hover:border-home-accent hover:text-home-accent motion-safe:transition-colors duration-150"
        >
          All tools
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-11 px-5 rounded-[var(--dash-radius-sm)] border border-white/20 text-[11px] font-bold uppercase tracking-[0.12em] text-dash-text hover:border-home-accent hover:text-home-accent motion-safe:transition-colors duration-150"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
