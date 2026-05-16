import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  Goal,
  Lock,
  Trophy,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { WorldCupLogo } from "@/components/ui/novee-logo";
import { CosmicBackground } from "@/components/marketing/cosmic-background";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/email-allowlist";

const KEY_DATES: { date: string; label: string }[] = [
  { date: "Jun 11", label: "Opening match — Mexico vs. opener" },
  { date: "Jun 11 – 27", label: "Group stage · 72 matches" },
  { date: "Jun 28 – Jul 3", label: "Round of 32" },
  { date: "Jul 4 – 7", label: "Round of 16" },
  { date: "Jul 9 – 11", label: "Quarter-finals" },
  { date: "Jul 14 – 15", label: "Semi-finals" },
  { date: "Jul 18", label: "Third-place play-off" },
  { date: "Jul 19", label: "Final — MetLife Stadium" },
];

const SCORING_ROWS: { label: string; group: string; knockout: string }[] = [
  { label: "Exact score", group: "3 points", knockout: "6 points" },
  { label: "Correct outcome (win / draw / loss)", group: "1 point", knockout: "2 points" },
  { label: "Wrong outcome", group: "0", knockout: "0" },
  { label: "No prediction submitted", group: "0", knockout: "0" },
];

const GROUP_BRACKET_ROWS: { label: string; value: string }[] = [
  { label: "Team in exact group position (1st / 2nd / 3rd / 4th)", value: "3 points each" },
  { label: "Team in correct half (top-2 or bottom-2), wrong slot", value: "1 point each" },
  { label: "Bracket — team correctly reached R32 / R16", value: "1 / 2 points" },
  { label: "Bracket — team correctly reached QF / SF", value: "4 / 8 points" },
  { label: "Bracket — team correctly reached 3rd-place match / Final", value: "4 / 16 points" },
  { label: "Tournament winner", value: "25 points" },
  { label: "Golden boot (top scorer)", value: "20 points" },
];

export default async function LandingPage() {
  // Public page: tolerate a stale/unreadable session cookie instead of 500ing.
  // A bad cookie surfaces from auth() as JWTSessionError; we just treat the
  // visitor as signed-out and let them re-authenticate via the CTA.
  const session = await auth().catch(() => null);
  const signedIn = Boolean(session?.user);
  const ctaHref = signedIn ? "/matches" : "/signin";
  const ctaLabel = signedIn ? "Continue to predictor" : "Sign in";
  return (
    <main className="dark relative min-h-screen flex flex-col text-white bg-[#0d0620]">
      <CosmicBackground />

      <header className="relative border-b border-white/10 backdrop-blur-md bg-black/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <WorldCupLogo size={32} priority />
            <span className="heading text-base text-white truncate">World Cup Predictor</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Chip
              size="small"
              color="brand"
              label={
                <>
                  <Lock className="size-3" />
                  <span className="hidden sm:inline">@{ALLOWED_EMAIL_DOMAIN} only</span>
                  <span className="sm:hidden">@{ALLOWED_EMAIL_DOMAIN}</span>
                </>
              }
              className="border-white/10 bg-white/5 text-white"
            />
            {signedIn && (
              <Button
                asChild
                size="sm"
                className="shadow-[0_0_24px_-8px_rgba(142,85,253,0.6)]"
              >
                <Link href="/matches">
                  <span className="hidden sm:inline">Continue to predictor</span>
                  <span className="sm:hidden">Continue</span>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16 min-w-0 overflow-x-hidden">
        <div className="w-full max-w-6xl min-w-0">
          {/* Hero copy, sitting directly on the cosmic background */}
          <div className="mb-10 grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
            <div className="flex flex-col items-start gap-5">
              <Chip
                size="small"
                color="brand"
                label={
                  <>
                    <WorldCupLogo size={16} />
                    <span>For Novee employees</span>
                  </>
                }
                className="border-white/15 bg-white/5 text-white backdrop-blur"
              />
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-medium leading-[1.05] tracking-tight max-w-4xl">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, #ffffff 0%, #f0e8ff 100%)",
                  }}
                >
                  Predict every match.
                </span>
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #ae92ff 0%, #8e55fd 50%, #c3b0ff 100%)",
                  }}
                >
                  Out-play your team.
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl">
                The Novee internal World Cup 2026 game. 104 matches, one live
                leaderboard, double points in the knockouts. Pick early, climb
                fast.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className="shadow-[0_0_40px_-8px_rgba(142,85,253,0.7)]">
                  <Link href={ctaHref}>
                    {ctaLabel} <ChevronRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#how-it-works">How it works</a>
                </Button>
              </div>
            </div>
            <div className="relative mx-auto md:mx-0">
              <div
                aria-hidden
                className="absolute inset-0 -m-16 rounded-full blur-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(142,85,253,0.55) 0%, transparent 70%)",
                }}
              />
              <WorldCupLogo
                size={420}
                priority
                className="relative size-56 md:size-[360px] lg:size-[420px] drop-shadow-[0_30px_80px_rgba(142,85,253,0.55)]"
              />
            </div>
          </div>

          {/* Glass card with tabs */}
          <Card
            id="how-it-works"
            className="scroll-mt-20 border-[#8e55fd]/25 bg-[#8e55fd]/[0.07] backdrop-blur-xl shadow-[0_30px_120px_-20px_rgba(142,85,253,0.7)]"
          >
            <CardContent>
              <Tabs defaultValue="how">
                <TabsList className="bg-[#8e55fd]/10 border border-[#8e55fd]/25">
                  <TabsTrigger
                    value="how"
                    className="data-[state=active]:bg-[#8e55fd]/30 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(142,85,253,0.5)] text-white/65"
                  >
                    How it works
                  </TabsTrigger>
                  <TabsTrigger
                    value="scoring"
                    className="data-[state=active]:bg-[#8e55fd]/30 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(142,85,253,0.5)] text-white/65"
                  >
                    Scoring
                  </TabsTrigger>
                  <TabsTrigger
                    value="schedule"
                    className="data-[state=active]:bg-[#8e55fd]/30 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(142,85,253,0.5)] text-white/65"
                  >
                    Schedule
                  </TabsTrigger>
                  <TabsTrigger
                    value="who"
                    className="data-[state=active]:bg-[#8e55fd]/30 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(142,85,253,0.5)] text-white/65"
                  >
                    Who can play
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="how">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FeatureBlock
                      number="01"
                      icon={<CalendarDays className="size-5" />}
                      title="Pick before kickoff"
                      body="Every match locks the moment it starts. Submit predictions early or tweak them right up to the whistle."
                    />
                    <FeatureBlock
                      number="02"
                      icon={<Trophy className="size-5" />}
                      title="Earn points"
                      body="3 for the exact score, 1 for the correct outcome. Knockout matches double."
                    />
                    <FeatureBlock
                      number="03"
                      icon={<Goal className="size-5" />}
                      title="Climb the standings"
                      body="The shared leaderboard updates after every match. See exactly where you stand vs. the team."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="scoring">
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5 text-white/70">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Outcome</th>
                          <th className="text-right px-4 py-3 font-medium">Group stage</th>
                          <th className="text-right px-4 py-3 font-medium">Knockouts</th>
                        </tr>
                      </thead>
                      <tbody className="text-white">
                        {SCORING_ROWS.map((row, i) => (
                          <tr
                            key={row.label}
                            className={i % 2 === 0 ? "" : "bg-white/[0.03]"}
                          >
                            <td className="px-4 py-3">{row.label}</td>
                            <td className="px-4 py-3 text-right code code-size-medium tabular-nums">
                              {row.group}
                            </td>
                            <td className="px-4 py-3 text-right code code-size-medium tabular-nums text-[#c3b0ff]">
                              {row.knockout}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm mt-3 text-white/60">
                    Example: predicting <span className="code">2–1</span> for an
                    England vs. France semi-final that ends{" "}
                    <span className="code">2–1</span> earns 6 points. Predicting{" "}
                    <span className="code">3–0</span> earns 2.
                  </p>

                  <h3 className="text-white text-base font-medium mt-6 mb-3">
                    Group &amp; bracket bonus points
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5 text-white/70">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">
                            Prediction
                          </th>
                          <th className="text-right px-4 py-3 font-medium">
                            Reward
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-white">
                        {GROUP_BRACKET_ROWS.map((row, i) => (
                          <tr
                            key={row.label}
                            className={i % 2 === 0 ? "" : "bg-white/[0.03]"}
                          >
                            <td className="px-4 py-3">{row.label}</td>
                            <td className="px-4 py-3 text-right code code-size-medium tabular-nums text-[#c3b0ff]">
                              {row.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm mt-3 text-white/60">
                    Rank every team in your group 1st through 4th, and fill out
                    the knockout bracket from Round of 32 to the Final.
                  </p>
                </TabsContent>

                <TabsContent value="schedule">
                  <ol className="flex flex-col">
                    {KEY_DATES.map((entry, i) => (
                      <li
                        key={entry.label}
                        className="flex items-center gap-4 py-2.5 border-b border-white/10 last:border-b-0"
                      >
                        <span className="code code-size-medium tabular-nums w-24 text-white/60">
                          {entry.date}
                        </span>
                        <span className="size-1.5 rounded-full bg-[#8e55fd] shadow-[0_0_12px_rgba(142,85,253,0.8)]" />
                        <span className="text-white/90">{entry.label}</span>
                        {i === 0 && (
                          <Chip
                            size="small"
                            color="amber"
                            label="Opening day"
                            className="ml-auto"
                          />
                        )}
                        {i === KEY_DATES.length - 1 && (
                          <Chip
                            size="small"
                            color="brand"
                            label="Final"
                            className="ml-auto"
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                </TabsContent>

                <TabsContent value="who">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-[#8e55fd]/40 bg-[#8e55fd]/10 p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-medium text-white">
                        <Flag className="size-4" /> You&apos;re in
                      </div>
                      <p className="text-sm text-white/70">
                        Anyone with an{" "}
                        <code className="code code-size-small text-[#c3b0ff]">
                          @{ALLOWED_EMAIL_DOMAIN}
                        </code>{" "}
                        address. Sign in with the work email you already use; we&apos;ll
                        email a one-tap link.
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-medium text-white/90">
                        <Lock className="size-4" /> No password, no account
                      </div>
                      <p className="text-sm text-white/70">
                        Magic-link sign-in. Predictions are private until kickoff,
                        then visible on the leaderboard. Admins can fix mistakes;
                        nobody else.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="relative border-t border-white/10 backdrop-blur-md bg-black/40 py-5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-white/60">
          <span>Built for the Novee team. Not affiliated with FIFA.</span>
          <span className="flex items-center gap-2">
            <WorldCupLogo size={18} /> Novee
          </span>
        </div>
      </footer>
    </main>
  );
}

function FeatureBlock({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#8e55fd]/25 bg-gradient-to-br from-[#8e55fd]/[0.08] to-[#8e55fd]/[0.02] p-5 flex flex-col gap-3 hover:border-[#8e55fd]/60 hover:from-[#8e55fd]/[0.15] transition-colors">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 size-32 rounded-full blur-2xl opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(142,85,253,0.5) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-center justify-between">
        <div className="size-10 rounded-md bg-gradient-to-br from-[#8e55fd]/40 to-[#8e55fd]/15 text-[#e0d6ff] grid place-items-center border border-[#8e55fd]/40 shadow-[0_0_20px_rgba(142,85,253,0.3)]">
          {icon}
        </div>
        <span className="code code-size-small text-[#c3b0ff]/50 tabular-nums">
          {number}
        </span>
      </div>
      <div className="relative">
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-sm text-white/70 mt-1">{body}</p>
      </div>
    </div>
  );
}
