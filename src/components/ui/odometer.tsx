"use client";

import { useEffect, useRef, useState } from "react";

const ANIM_DURATION_MS = 400;

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Count-up animation for numeric stats. Tracks the previous rendered value in
 * sessionStorage so reloads animate from the last seen value rather than zero.
 * No-ops when `prefers-reduced-motion: reduce` is set.
 */
export function Odometer({
  value,
  storageKey,
  className,
}: {
  value: number;
  storageKey: string;
  className?: string;
}) {
  const [display, setDisplay] = useState<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(storageKey);
    const startFrom = stored !== null ? Number(stored) : value;
    if (reducedMotion() || startFrom === value) {
      setDisplay(value);
      window.sessionStorage.setItem(storageKey, String(value));
      return;
    }
    setDisplay(startFrom);
    const t0 = performance.now();
    const diff = value - startFrom;
    function step(now: number) {
      const t = Math.min(1, (now - t0) / ANIM_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startFrom + diff * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        window.sessionStorage.setItem(storageKey, String(value));
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, storageKey]);

  return <span className={className}>{display}</span>;
}
