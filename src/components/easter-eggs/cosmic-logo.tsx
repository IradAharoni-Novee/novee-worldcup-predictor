"use client";

import type { MouseEvent, PointerEvent } from "react";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorldCupLogo } from "@/components/ui/novee-logo";

const LONG_PRESS_MS = 3000;

/**
 * Clickable VeeVee logo that routes home. Hidden long-press easter egg:
 * holding the logo for 3 seconds diverts to /cosmos instead.
 */
export function CosmicLogo({ size = 28 }: { size?: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(event: PointerEvent<HTMLAnchorElement>) {
    if (event.button !== 0) return;
    firedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(40);
      }
      router.push("/cosmos");
    }, LONG_PRESS_MS);
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (firedRef.current) {
      event.preventDefault();
      firedRef.current = false;
    }
  }

  return (
    <Link
      href="/"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="World Cup Predictor — home"
      className="cursor-pointer rounded-md select-none [-webkit-touch-callout:none] touch-manipulation"
    >
      <WorldCupLogo size={size} priority />
    </Link>
  );
}
