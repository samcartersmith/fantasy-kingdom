import Link from "next/link";

/** Example promos — replace `href: "#"` entries with real destinations when available. */
const FEATURED_LINKS: { label: string; href: string }[] = [
  { label: "2026 Half-PPR Draft Rankings", href: "#" },
  { label: "Dynasty Rankings", href: "/rankings" },
  { label: "Rookie Rankings", href: "#" },
  { label: "Dynasty Expert Directory", href: "#" },
  { label: "Dynasty Quarterback Rankings", href: "#" },
  { label: "Dynasty Running Back Rankings", href: "#" },
  { label: "Dynasty Tight End Rankings", href: "#" },
  { label: "Dynasty Wide Receiver Rankings", href: "#" },
  { label: "Sleeper Rankings", href: "https://sleeper.com" },
  { label: "PPR Cheatsheet", href: "#" },
];

const linkClass =
  "cursor-pointer min-h-11 inline-flex items-center text-sm font-medium text-dash-text/90 hover:text-dash-primary rounded-[var(--dash-radius-sm)] motion-safe:transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";

export function TradeFeaturedLinks() {
  return (
    <aside aria-labelledby="trade-featured-links-title">
      <h3
        id="trade-featured-links-title"
        className="dash-heading-subsection text-dash-text mb-2"
      >
        Featured Links
      </h3>
      <div className="dash-glass-panel rounded-[var(--dash-radius-md)] p-4 sm:p-5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-transparent"
          aria-hidden
        />
        <nav className="relative">
          <ul className="flex flex-col gap-y-0.5">
            {FEATURED_LINKS.map((item) => (
              <li key={item.label}>
                {item.href.startsWith("/") ? (
                  <Link
                    href={item.href}
                    className={`${linkClass} hover:underline`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={item.href}
                    className={`${linkClass} hover:underline`}
                    {...(item.href !== "#"
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
