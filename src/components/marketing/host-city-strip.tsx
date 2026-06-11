// An auto-scrolling marquee of the official FIFA World Cup 26 host-city posters.
// Each card flips on hover to reveal that city's host-city kit on the back, set
// on a background tinted to the city's artwork. The strip duplicates its contents
// so the scroll loops seamlessly, pauses on hover, and freezes under
// prefers-reduced-motion (handled by .lp-marquee / .flip-inner in globals.css).

import Image from "next/image";

type Card = {
  poster: string;
  jersey: string;
  city: string;
  nation: string;
  tint: string;
};

const CARDS: Card[] = [
  { poster: "/fifa/poster-vancouver.jpg", jersey: "/fifa/jersey-vancouver.png", city: "Vancouver", nation: "Canada", tint: "#679ad2" },
  { poster: "/fifa/poster-seattle.jpg", jersey: "/fifa/jersey-seattle.png", city: "Seattle", nation: "USA", tint: "#65c3a8" },
  { poster: "/fifa/poster-sanfrancisco.jpg", jersey: "/fifa/jersey-sanfrancisco.png", city: "San Francisco", nation: "USA", tint: "#ee4f28" },
  { poster: "/fifa/poster-losangeles.jpg", jersey: "/fifa/jersey-losangeles.png", city: "Los Angeles", nation: "USA", tint: "#dda78d" },
  { poster: "/fifa/poster-guadalajara.jpg", jersey: "/fifa/jersey-guadalajara.png", city: "Guadalajara", nation: "Mexico", tint: "#ee3a73" },
  { poster: "/fifa/poster-mexicocity.jpg", jersey: "/fifa/jersey-mexicocity.png", city: "Mexico City", nation: "Mexico", tint: "#f1952f" },
  { poster: "/fifa/poster-monterrey.jpg", jersey: "/fifa/jersey-monterrey.png", city: "Monterrey", nation: "Mexico", tint: "#28277e" },
  { poster: "/fifa/poster-dallas.jpg", jersey: "/fifa/jersey-dallas.png", city: "Dallas", nation: "USA", tint: "#0474a2" },
  { poster: "/fifa/poster-houston.jpg", jersey: "/fifa/jersey-houston.png", city: "Houston", nation: "USA", tint: "#1f419a" },
  { poster: "/fifa/poster-kansascity.jpg", jersey: "/fifa/jersey-kansascity.png", city: "Kansas City", nation: "USA", tint: "#5acbdc" },
  { poster: "/fifa/poster-atlanta.jpg", jersey: "/fifa/jersey-atlanta.png", city: "Atlanta", nation: "USA", tint: "#186dad" },
  { poster: "/fifa/poster-miami.png", jersey: "/fifa/jersey-miami.png", city: "Miami", nation: "USA", tint: "#f493aa" },
  { poster: "/fifa/poster-toronto.jpg", jersey: "/fifa/jersey-toronto.png", city: "Toronto", nation: "Canada", tint: "#394ff4" },
  { poster: "/fifa/poster-philadelphia.jpg", jersey: "/fifa/jersey-philadelphia.png", city: "Philadelphia", nation: "USA", tint: "#074e99" },
  { poster: "/fifa/poster-newyork.jpg", jersey: "/fifa/jersey-newyork.png", city: "New York / NJ", nation: "USA", tint: "#1f28a1" },
  { poster: "/fifa/poster-boston.png", jersey: "/fifa/jersey-boston.png", city: "Boston", nation: "USA", tint: "#598fac" },
];

const FACE =
  "flip-face overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)]";

function FlipCard({ poster, jersey, city, nation, tint }: Card) {
  return (
    <figure className="relative w-40 shrink-0 sm:w-48">
      <div className="flip-card aspect-[2/3]">
        <div className="flip-inner">
          <div className={`${FACE} bg-white/5`}>
            <Image
              src={poster}
              alt={`${city} FIFA World Cup 26 poster`}
              width={1000}
              height={1500}
              quality={90}
              className="size-full object-cover"
            />
          </div>
          <div
            className={`${FACE} flip-back`}
            style={{
              background: `linear-gradient(150deg, color-mix(in srgb, ${tint} 84%, #fff), color-mix(in srgb, ${tint} 58%, #000))`,
            }}
          >
            <Image
              src={jersey}
              alt={`${city} host-city kit`}
              width={1000}
              height={1000}
              quality={90}
              className="size-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-2 px-1">
        <span className="font-medium text-white">{city}</span>
        <span className="code code-size-small uppercase tracking-wide text-white/45">
          {nation}
        </span>
      </figcaption>
    </figure>
  );
}

export function HostCityStrip() {
  return (
    <div
      className="group/marquee relative flex w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
      }}
    >
      <div className="lp-marquee flex shrink-0 gap-5 pr-5">
        {CARDS.map((c) => (
          <FlipCard key={c.city} {...c} />
        ))}
      </div>
      <div aria-hidden className="lp-marquee flex shrink-0 gap-5 pr-5">
        {CARDS.map((c) => (
          <FlipCard key={`${c.city}-dup`} {...c} />
        ))}
      </div>
    </div>
  );
}
