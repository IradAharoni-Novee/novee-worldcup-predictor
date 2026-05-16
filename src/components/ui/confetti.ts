import confetti from "canvas-confetti";

const BRAND_COLORS = ["#8E5BFD", "#C3B0FF", "#FFAB72", "#4BADFF", "#25FFAC"];

const STORAGE_PREFIX = "veevee:celebrated:";

type Intensity = "small" | "medium" | "big";

const PRESETS: Record<Intensity, { particleCount: number; spread: number; ticks: number }> = {
  small: { particleCount: 40, spread: 60, ticks: 80 },
  medium: { particleCount: 90, spread: 80, ticks: 120 },
  big: { particleCount: 180, spread: 100, ticks: 180 },
};

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fire confetti once per `eventKey` per user, no matter how many times this is
 * called. Pass a unique key per (event, userId) so the same milestone never
 * pops twice.
 */
export function celebrateOnce(eventKey: string, intensity: Intensity = "medium"): void {
  if (reducedMotion()) return;
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${eventKey}`;
  if (window.localStorage.getItem(key)) return;
  window.localStorage.setItem(key, String(Date.now()));

  const preset = PRESETS[intensity];
  confetti({
    particleCount: preset.particleCount,
    spread: preset.spread,
    ticks: preset.ticks,
    origin: { x: 0.5, y: 0.3 },
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
  });
}
