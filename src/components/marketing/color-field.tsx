// Vivid "festival" backdrop for the landing page — a deep navy base flooded
// with large, slowly drifting color blobs drawn from the FIFA World Cup 26
// host-city palette (magenta, sunset, cyan, lime, violet) layered over the
// tournament tri-color, plus a faint diagonal panel sweep and a grain wash.
// Replaces the older cosmic/starfield treatment.

const BLOBS: {
  className: string;
  color: string;
  delay: string;
  duration: string;
}[] = [
  {
    className: "-top-40 -left-32 size-[640px]",
    color: "rgba(255,45,155,0.72)", // magenta — Miami flamingo
    delay: "0s",
    duration: "19s",
  },
  {
    className: "-top-48 right-[-10%] size-[700px]",
    color: "rgba(24,207,230,0.66)", // cyan — Seattle
    delay: "-6s",
    duration: "23s",
  },
  {
    className: "top-[32%] left-[38%] size-[580px]",
    color: "rgba(123,63,242,0.62)", // violet
    delay: "-3s",
    duration: "21s",
  },
  {
    className: "bottom-[-15%] left-[-8%] size-[660px]",
    color: "rgba(5,116,63,0.66)", // tournament green
    delay: "-9s",
    duration: "25s",
  },
  {
    className: "bottom-[-20%] right-[-6%] size-[640px]",
    color: "rgba(255,90,31,0.7)", // sunset — LA
    delay: "-12s",
    duration: "20s",
  },
  {
    className: "top-[18%] left-[6%] size-[440px]",
    color: "rgba(205,1,4,0.6)", // tournament red
    delay: "-5s",
    duration: "22s",
  },
];

export function ColorField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* deep navy base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -10%, #0b1844 0%, #081232 38%, #04081c 78%)",
        }}
      />

      {/* diagonal vivid panel sweep — echoes the host-city campaign key art */}
      <div
        className="absolute inset-0 opacity-[0.34] mix-blend-screen"
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, rgba(24,207,230,0.6) 16%, transparent 30%, rgba(123,63,242,0.65) 50%, transparent 62%, rgba(255,45,155,0.6) 80%, transparent 94%)",
        }}
      />

      {/* drifting festival blobs */}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className={`lp-drift absolute rounded-full blur-3xl ${b.className}`}
          style={{
            background: `radial-gradient(circle at center, ${b.color} 0%, transparent 70%)`,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}

      {/* lime spark, kept small so it reads as an accent, not a wash */}
      <div
        className="lp-drift absolute top-[58%] right-[22%] size-[320px] rounded-full blur-3xl opacity-90"
        style={{
          background:
            "radial-gradient(circle at center, rgba(182,243,40,0.5) 0%, transparent 70%)",
          animationDelay: "-15s",
          animationDuration: "24s",
        }}
      />

      {/* readability scrim — anchored to the left text column so white type stays
          crisp while the right side keeps its full color */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 26% 38%, rgba(4,8,28,0.5) 0%, transparent 58%), linear-gradient(180deg, rgba(4,8,28,0.42) 0%, transparent 20%, transparent 72%, rgba(4,8,28,0.4) 100%)",
        }}
      />

      {/* fine grain to stop the gradients banding */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
