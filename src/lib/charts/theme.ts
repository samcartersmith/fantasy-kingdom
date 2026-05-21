export type DashChartTheme = {
  primary: string;
  text: string;
  textMuted: string;
  border: string;
  barTrack: string;
  fontFamily: string;
  reducedMotion: boolean;
};

const FALLBACK: DashChartTheme = {
  primary: "#0c5cab",
  text: "#fafafa",
  textMuted: "rgba(250, 250, 250, 0.6)",
  border: "rgba(255, 255, 255, 0.45)",
  barTrack: "rgba(255, 255, 255, 0.08)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  reducedMotion: false,
};

function readVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const v = style.getPropertyValue(name).trim();
  return v || fallback;
}

/** Read dashboard design tokens for SVG charts (browser-only). */
export function readDashChartTheme(el?: Element | null): DashChartTheme {
  if (typeof window === "undefined") {
    return FALLBACK;
  }
  const target = el ?? document.documentElement;
  const style = getComputedStyle(target);
  const bodyStyle = getComputedStyle(document.body);
  return {
    primary: readVar(style, "--dash-primary", FALLBACK.primary),
    text: readVar(style, "--dash-text", FALLBACK.text),
    textMuted: "rgba(250, 250, 250, 0.6)",
    border: readVar(style, "--dash-border", FALLBACK.border),
    barTrack: "rgba(255, 255, 255, 0.08)",
    fontFamily: bodyStyle.fontFamily || FALLBACK.fontFamily,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
