"use client";

import { useEffect } from "react";
import { celebrateOnce } from "@/components/ui/confetti";

/**
 * Fires confetti exactly once per (event, user) combination. Mount on /me;
 * the localStorage flag inside celebrateOnce guarantees idempotency across
 * reloads.
 */
export function CelebrationTrigger({
  userId,
  hasFirstExact,
  inTop3,
}: {
  userId: string;
  hasFirstExact: boolean;
  inTop3: boolean;
}) {
  useEffect(() => {
    if (hasFirstExact) {
      celebrateOnce(`firstExact:${userId}`, "medium");
    }
    if (inTop3) {
      celebrateOnce(`top3:${userId}`, "big");
    }
  }, [userId, hasFirstExact, inTop3]);

  return null;
}
