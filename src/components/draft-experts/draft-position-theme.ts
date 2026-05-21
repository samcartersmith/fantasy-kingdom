/** Position-tinted cell backgrounds for draft board grid (dash dark theme). */
export function draftPositionCellClass(position: string): string {
  const pos = position.toUpperCase();
  switch (pos) {
    case "QB":
      return "bg-[oklch(0.32_0.06_15)] border-[oklch(0.42_0.08_15/0.5)]";
    case "RB":
      return "bg-[oklch(0.32_0.06_145)] border-[oklch(0.42_0.08_145/0.5)]";
    case "WR":
      return "bg-[oklch(0.32_0.06_220)] border-[oklch(0.42_0.08_220/0.5)]";
    case "TE":
      return "bg-[oklch(0.34_0.06_75)] border-[oklch(0.44_0.08_75/0.5)]";
    default:
      return "bg-black/35 border-white/12";
  }
}
