"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 60_000;

// Mounted only while a match is live. Every minute it triggers a throttled
// server-side score sync, then refreshes the route so the server-rendered
// scores and LIVE badge update in place. Stops once nothing is live.
export function LiveScoreRefresher() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/live-scores", { method: "POST" });
          if (res.ok) {
            const data = (await res.json()) as { live?: number };
            router.refresh();
            if (data.live === 0) return; // matches over — stop polling
          }
        } catch {
          // Network blip — fall through and retry on the next tick.
        }
      }
      timer = setTimeout(tick, INTERVAL_MS);
    }

    void tick(); // fire immediately so a freshly opened page syncs right away
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return null;
}
