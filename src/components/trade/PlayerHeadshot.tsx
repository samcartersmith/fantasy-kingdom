"use client";

import { useState } from "react";

type Props = {
  imageUrl: string | null | undefined;
  name: string;
  className?: string;
};

const frame =
  "relative size-10 shrink-0 overflow-hidden rounded-[var(--dash-radius-sm)] bg-white/[0.08] ring-1 ring-white/10";

/**
 * Sleeper CDN headshot with lazy load; fixed slot shows initials when missing or broken.
 */
export function PlayerHeadshot({ imageUrl, name, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(imageUrl && !failed);

  return (
    <div className={`${frame} ${className}`.trim()}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- Sleeper CDN; avoid next/image remotePatterns
        <img
          src={imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-dash-text/45 select-none"
          aria-hidden
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}
