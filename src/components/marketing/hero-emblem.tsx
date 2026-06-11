// The hero centerpiece: the official Trionda match ball floating on the
// festival color-field. A rotating aura in the FIFA World Cup 26 brights glows
// behind it, a warm light lifts it off the dark background, and the whole
// emblem drifts gently.

import Image from "next/image";
import { cn } from "@/lib/cn";

export function HeroEmblem({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  // The outer element carries the entrance/positioning classes from the
  // caller; the inner one owns the perpetual float — keeping them separate
  // avoids two `animation` shorthands colliding on one element.
  return (
    <div className={cn("relative grid place-items-center", className)} style={style}>
      <div className="lp-float relative grid place-items-center">
        {/* warm light behind the trophy so the gold reads off the dark field */}
        <div
          aria-hidden
          className="pointer-events-none absolute size-[280px] rounded-full blur-3xl md:size-[400px] lg:size-[460px]"
          style={{
            background:
              "radial-gradient(circle, rgba(255,200,61,0.28) 0%, rgba(255,90,31,0.16) 45%, transparent 72%)",
          }}
        />

        {/* rotating festival aura — the host-city brights in motion */}
        <div
          aria-hidden
          className="lp-halo-spin pointer-events-none absolute size-[230px] rounded-full opacity-70 blur-2xl md:size-[320px] lg:size-[360px]"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255,45,155,0.75), rgba(24,207,230,0.65), rgba(182,243,40,0.6), rgba(123,63,242,0.7), rgba(255,90,31,0.7), rgba(255,45,155,0.75))",
          }}
        />

        <Image
          src="/fifa/trionda-ball.png"
          alt="Trionda — the official FIFA World Cup 26 match ball"
          width={800}
          height={800}
          priority
          className="relative size-[230px] md:size-[340px] lg:size-[400px]"
          style={{
            filter:
              "drop-shadow(0 0 30px rgba(255,255,255,0.18)) drop-shadow(0 18px 38px rgba(2,8,24,0.6))",
          }}
        />
      </div>
    </div>
  );
}
