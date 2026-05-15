// Cosmic backdrop borrowed from novee.security — pure-black canvas with a
// glowing purple orb, a starfield, and a low-aurora glow along the bottom.

export function CosmicBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* deep purple-tinted base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #1a0d33 0%, #100624 35%, #07050d 75%)",
        }}
      />

      {/* primary purple orb (top-right) */}
      <div
        className="absolute -top-48 -right-48 size-[900px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(174,146,255,0.75) 0%, rgba(142,85,253,0.6) 18%, rgba(102,52,212,0.35) 40%, transparent 72%)",
        }}
      />

      {/* secondary purple orb (top-left) */}
      <div
        className="absolute -top-32 -left-40 size-[640px] rounded-full blur-3xl opacity-90"
        style={{
          background:
            "radial-gradient(circle at center, rgba(142,85,253,0.6) 0%, rgba(102,52,212,0.35) 30%, transparent 70%)",
        }}
      />

      {/* mid-page violet wash */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle at center, rgba(195,176,255,0.4) 0%, rgba(142,85,253,0.3) 40%, transparent 75%)",
        }}
      />

      {/* aurora ribbon along the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-96"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 110%, rgba(174,146,255,0.7) 0%, rgba(142,85,253,0.45) 25%, rgba(102,52,212,0.2) 50%, transparent 75%)",
        }}
      />

      {/* purple grid wash on top of everything */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "linear-gradient(180deg, rgba(142,85,253,0.12) 0%, transparent 25%, rgba(142,85,253,0.08) 60%, rgba(142,85,253,0.2) 100%)",
        }}
      />

      {/* starfield: an svg with ~110 randomly-placed stars */}
      <svg
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox="0 0 1200 900"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
          />
        ))}
      </svg>

      {/* faint top vignette so the header text stays readable */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
    </div>
  );
}

const STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 32, y: 48, r: 0.7, o: 0.6 }, { x: 88, y: 130, r: 1, o: 0.85 },
  { x: 145, y: 70, r: 0.6, o: 0.5 }, { x: 210, y: 200, r: 1.2, o: 0.9 },
  { x: 268, y: 92, r: 0.8, o: 0.7 }, { x: 320, y: 280, r: 0.6, o: 0.4 },
  { x: 390, y: 60, r: 1.1, o: 0.85 }, { x: 462, y: 165, r: 0.7, o: 0.5 },
  { x: 530, y: 250, r: 0.9, o: 0.7 }, { x: 600, y: 40, r: 0.8, o: 0.6 },
  { x: 670, y: 145, r: 1.3, o: 0.95 }, { x: 745, y: 80, r: 0.7, o: 0.55 },
  { x: 822, y: 215, r: 0.6, o: 0.4 }, { x: 890, y: 60, r: 1, o: 0.8 },
  { x: 950, y: 175, r: 0.8, o: 0.65 }, { x: 1010, y: 100, r: 0.9, o: 0.7 },
  { x: 1080, y: 230, r: 0.6, o: 0.45 }, { x: 1150, y: 55, r: 1.1, o: 0.85 },
  { x: 60, y: 350, r: 0.8, o: 0.6 }, { x: 130, y: 420, r: 0.6, o: 0.4 },
  { x: 200, y: 380, r: 1, o: 0.75 }, { x: 280, y: 470, r: 0.7, o: 0.55 },
  { x: 360, y: 410, r: 0.9, o: 0.7 }, { x: 430, y: 360, r: 0.6, o: 0.45 },
  { x: 500, y: 490, r: 1.2, o: 0.9 }, { x: 580, y: 380, r: 0.8, o: 0.6 },
  { x: 650, y: 460, r: 0.7, o: 0.5 }, { x: 720, y: 400, r: 1, o: 0.75 },
  { x: 790, y: 470, r: 0.6, o: 0.4 }, { x: 870, y: 370, r: 0.9, o: 0.7 },
  { x: 935, y: 480, r: 0.8, o: 0.6 }, { x: 1000, y: 410, r: 1.1, o: 0.85 },
  { x: 1075, y: 470, r: 0.7, o: 0.5 }, { x: 1140, y: 380, r: 0.9, o: 0.7 },
  { x: 25, y: 600, r: 0.6, o: 0.4 }, { x: 95, y: 550, r: 1, o: 0.75 },
  { x: 170, y: 660, r: 0.8, o: 0.6 }, { x: 240, y: 590, r: 0.7, o: 0.55 },
  { x: 310, y: 700, r: 0.9, o: 0.65 }, { x: 380, y: 540, r: 0.6, o: 0.45 },
  { x: 450, y: 660, r: 1.2, o: 0.9 }, { x: 530, y: 590, r: 0.8, o: 0.6 },
  { x: 605, y: 710, r: 0.7, o: 0.5 }, { x: 680, y: 600, r: 1, o: 0.75 },
  { x: 755, y: 680, r: 0.6, o: 0.4 }, { x: 830, y: 570, r: 0.9, o: 0.7 },
  { x: 905, y: 690, r: 0.8, o: 0.6 }, { x: 980, y: 600, r: 1.1, o: 0.85 },
  { x: 1050, y: 670, r: 0.7, o: 0.5 }, { x: 1120, y: 580, r: 0.9, o: 0.7 },
  { x: 55, y: 800, r: 0.8, o: 0.6 }, { x: 125, y: 760, r: 0.6, o: 0.4 },
  { x: 195, y: 830, r: 1, o: 0.75 }, { x: 265, y: 780, r: 0.7, o: 0.55 },
  { x: 340, y: 850, r: 0.9, o: 0.65 }, { x: 415, y: 770, r: 0.6, o: 0.45 },
  { x: 490, y: 820, r: 1.1, o: 0.85 }, { x: 565, y: 780, r: 0.8, o: 0.6 },
  { x: 640, y: 860, r: 0.7, o: 0.5 }, { x: 715, y: 790, r: 0.9, o: 0.7 },
  { x: 790, y: 830, r: 0.6, o: 0.4 }, { x: 865, y: 780, r: 0.8, o: 0.6 },
  { x: 940, y: 850, r: 1, o: 0.75 }, { x: 1015, y: 800, r: 0.7, o: 0.5 },
  { x: 1090, y: 870, r: 0.9, o: 0.7 }, { x: 1160, y: 800, r: 0.6, o: 0.4 },
];
