"use client";

import { useEffect } from "react";

const ART = String.raw`
        ___________
       '._==_==_=_.'
       .-\:      /-.
      | (|:.     |) |
       '-|:.     |-'
         \::.    /
          '::. .'
            ) (
          _.' '._
         '-------'
`;

const TAGLINE =
  "nice. VeeVee sees you. Consider this your welcome to the cosmos.";

/**
 * Print a small purple ASCII trophy + tagline to the browser console once per
 * page load. Mirrors the existing dev magic-link console styling.
 */
export function DevConsoleArt() {
  useEffect(() => {
    const slot = globalThis as unknown as { __veeveeArtShown?: boolean };
    if (slot.__veeveeArtShown) return;
    slot.__veeveeArtShown = true;
    // eslint-disable-next-line no-console
    console.log(`%c${ART}`, "color:#8e5bfd;font-family:monospace;");
    // eslint-disable-next-line no-console
    console.log(`%c${TAGLINE}`, "color:#c3b0ff;font-weight:bold");
  }, []);
  return null;
}
