"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/trade", label: "Trade calculator", match: (p: string) => p.startsWith("/trade") },
  { href: "/rankings", label: "Rankings", match: (p: string) => p.startsWith("/rankings") },
  { href: "/leagues", label: "Leagues", match: (p: string) => p.startsWith("/leagues") },
  { href: "/resources", label: "Resources", match: (p: string) => p.startsWith("/resources") },
] as const;

const navLinkBase =
  "text-[11px] sm:text-xs font-medium uppercase tracking-[0.14em] text-dash-text/75 hover:text-home-accent motion-safe:transition-colors duration-150 min-h-11 inline-flex flex-col items-center justify-center gap-1.5 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14]";

const navLinkActive = "text-home-accent";

export function SiteHeader() {
  const pathname = usePathname();
  const useHomeChrome = pathname === "/" || pathname.startsWith("/leagues") || pathname.startsWith("/resources");

  return (
    <header
      className={`sticky top-0 z-30 shrink-0 border-b border-white/8 bg-[#050a14]/95 backdrop-blur-sm ${pathname === "/" ? "home-header-reveal" : ""}`}
    >
      <div className="max-w-[min(90rem,calc(100vw-2rem))] mx-auto px-4 sm:px-6 lg:px-8 min-h-[4.25rem] flex items-center justify-between gap-4 lg:gap-8">
        <Link
          href="/"
          className="shrink-0 leading-tight rounded-[var(--dash-radius-sm)] min-h-11 inline-flex flex-col justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14]"
        >
          <span className="text-sm font-bold uppercase tracking-[0.12em] text-dash-text">Fantasy</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-dash-text/55 -mt-0.5">
            Kingdom
          </span>
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center justify-center gap-5 lg:gap-7 flex-1">
          {navItems.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`${navLinkBase} ${active ? navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span>{label}</span>
                <span
                  className={`h-px w-full motion-safe:transition-colors motion-safe:duration-200 ${active ? "bg-home-accent" : "bg-transparent"}`}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <nav aria-label="Mobile tools" className="flex md:hidden items-center gap-3">
            {navItems.slice(1, 4).map(({ href, label }) => (
              <Link key={href} href={href} className={`${navLinkBase} text-dash-text/85`}>
                {label === "Trade calculator" ? "Trade" : label}
              </Link>
            ))}
          </nav>
          <Link
            href="/trade"
            className={
              useHomeChrome
                ? "hidden sm:inline-flex items-center justify-center min-h-10 px-4 rounded-[var(--dash-radius-sm)] bg-home-accent text-[#050a14] text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-home-accent-hover motion-safe:transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14]"
                : "hidden sm:inline-flex items-center justify-center min-h-10 px-4 rounded-[var(--dash-radius-sm)] bg-dash-primary text-dash-text text-sm font-semibold hover:bg-dash-primary/90 motion-safe:transition-colors duration-150"
            }
          >
            {useHomeChrome ? "Get started" : "Trade calculator"}
          </Link>
        </div>
      </div>
    </header>
  );
}
