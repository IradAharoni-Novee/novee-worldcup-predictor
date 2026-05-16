"use client";

import { useRouter } from "next/navigation";
import { VeeVeeLogo } from "@/components/ui/novee-logo";

const STORAGE_KEY = "veevee:clicks";
const WINDOW_MS = 10_000;
const THRESHOLD = 10;

type ClickState = { count: number; started: number };

function readState(): ClickState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ClickState>;
    if (typeof v.count === "number" && typeof v.started === "number") {
      return { count: v.count, started: v.started };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Clickable VeeVee logo with a hidden click counter. Ten clicks within ten
 * seconds routes to /cosmos; otherwise the click does nothing. State persists
 * across page navigations via sessionStorage.
 */
export function CosmicLogo({ size = 28 }: { size?: number }) {
  const router = useRouter();

  function onClick() {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const state = readState();

    if (!state || now - state.started > WINDOW_MS) {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: 1, started: now })
      );
      return;
    }
    const nextCount = state.count + 1;
    if (nextCount >= THRESHOLD) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      router.push("/cosmos");
      return;
    }
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ count: nextCount, started: state.started })
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="VeeVee"
      className="cursor-pointer rounded-full"
    >
      <VeeVeeLogo size={size} />
    </button>
  );
}
