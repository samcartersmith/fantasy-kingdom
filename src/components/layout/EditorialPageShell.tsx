import type { ReactNode } from "react";

type PageSurface = "home" | "editorial" | "tool";

type Props = {
  children: ReactNode;
  /** Applies body background treatment via :has() in globals.css */
  surface?: PageSurface;
  /** Extra classes on the inner 90rem content column (e.g. vertical padding) */
  className?: string;
};

const surfaceClass: Record<PageSurface, string | undefined> = {
  home: "home-page",
  editorial: "editorial-page",
  tool: undefined,
};

/**
 * Shared full-width breakout + 90rem content shell (matches Home and Trade).
 * Cap: min(90rem, calc(100vw - 2rem)) → 1440px max with 1rem viewport gutter each side.
 */
export function EditorialPageShell({ children, surface = "editorial", className }: Props) {
  const pageClass = surfaceClass[surface];
  const overflowClip = surface === "tool";

  return (
    <div
      className={[
        pageClass,
        "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2",
        overflowClip ? "overflow-x-clip" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))] px-4 sm:px-6 lg:px-8",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
