"use client";

import { useEffect } from "react";
import { veeveeLine } from "@/lib/veevee-voice";
import { veeveeToast } from "@/components/ui/veevee-toast";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

const TINT_DURATION_MS = 30_000;

/**
 * Global key listener for the Konami code. On match, tints the body with a
 * cosmic class for 30s and toasts a VeeVee line. Triggers at most once per
 * tint window to avoid stacking effects.
 */
export function KonamiListener() {
  useEffect(() => {
    let position = 0;
    let cooldown = false;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Ignore keypresses while typing into inputs.
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      const expected = SEQUENCE[position];
      if (e.code === expected) {
        position += 1;
        if (position === SEQUENCE.length) {
          position = 0;
          if (!cooldown) {
            trigger();
          }
        }
      } else {
        position = e.code === SEQUENCE[0] ? 1 : 0;
      }
    }

    function trigger() {
      cooldown = true;
      document.body.classList.add("veevee-konami");
      showSplash();
      veeveeToast(veeveeLine("konami"));
      setTimeout(() => {
        document.body.classList.remove("veevee-konami");
        cooldown = false;
      }, TINT_DURATION_MS);
    }

    function showSplash() {
      const overlay = document.createElement("div");
      overlay.className = "veevee-konami-splash";
      const title = document.createElement("div");
      title.className = "veevee-konami-splash__title";
      title.textContent = "CHEAT MODE";
      const subtitle = document.createElement("div");
      subtitle.className = "veevee-konami-splash__subtitle";
      subtitle.textContent = "VeeVee acknowledges the gesture";
      const wrap = document.createElement("div");
      wrap.style.textAlign = "center";
      wrap.appendChild(title);
      wrap.appendChild(subtitle);
      overlay.appendChild(wrap);
      document.body.appendChild(overlay);
      // Auto-remove after the CSS animation finishes (5000ms + 200ms slack).
      setTimeout(() => overlay.remove(), 5200);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
