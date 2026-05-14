import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  Goal,
  Lock,
  Trophy,
} from "lucide-react";
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
import { VeeVeeLogo } from "@/components/ui/novee-logo";
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

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[color:var(--color-bg-secondary)]">
      <header className="border-b border-[color:var(--color-border-primary)] bg-background">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <VeeVeeLogo size={28} />
            <span className="heading text-base">World Cup Predictor</span>
          </Link>
          <Chip
            size="small"
            color="brand"
            label={
              <span className="flex items-center gap-1">
                <Lock className="size-3" />
                @{ALLOWED_EMAIL_DOMAIN} only
              </span>
            }
          />
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-6 py-12">
        <Card className="w-full max-w-6xl py-0 gap-0 overflow-hidden shadow-md">
          <div className="bg-gradient-to-br from-[color:var(--color-brand-300)] via-[color:var(--color-brand-100)] to-white px-10 pt-10 pb-8 border-b border-[color:var(--color-border-secondary)]">
            <div className="flex items-start justify-between gap-8">
              <div className="min-w-0">
                <Chip
                  size="small"
                  color="brand"
                  label={
                    <>
                      <VeeVeeLogo size={14} />
                      <span>For Novee employees</span>
                    </>
                  }
                />
                <h1 className="heading mt-4 text-4xl md:text-5xl leading-[1.1] tracking-tight">
                  Predict every match of
                  <br />
                  the World Cup 2026.
                </h1>
                <p className="body body-size-large mt-4 text-[color:var(--color-text-secondary)] max-w-2xl">
                  An internal game for the Novee team. 104 matches, one live
                  leaderboard, double points in the knockouts.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link href="/signin">
                  Sign in <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="how" className="px-10 pt-8 pb-10">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="how">How it works</TabsTrigger>
              <TabsTrigger value="scoring">Scoring</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="who">Who can play</TabsTrigger>
            </TabsList>

            <TabsContent value="how">
              <div className="grid gap-4 md:grid-cols-3">
                <FeatureBlock
                  icon={<CalendarDays className="size-5" />}
                  color="brand"
                  title="Pick before kickoff"
                  body="Every match locks the moment it starts. Submit predictions early or tweak them right until the whistle."
                />
                <FeatureBlock
                  icon={<Trophy className="size-5" />}
                  color="green"
                  title="Earn points"
                  body="3 points for the exact score, 1 for the correct outcome. Knockout matches double."
                />
                <FeatureBlock
                  icon={<Goal className="size-5" />}
                  color="blue"
                  title="Climb the standings"
                  body="The shared leaderboard updates after every match. See exactly where you stand vs. the team."
                />
              </div>
            </TabsContent>

            <TabsContent value="scoring">
              <div className="overflow-hidden rounded-lg border border-[color:var(--color-border-secondary)]">
                <table className="w-full text-sm">
                  <thead className="bg-[color:var(--color-surface-secondary)]">
                    <tr>
                      <th className="text-left px-4 py-2 body body-weight-medium">Outcome</th>
                      <th className="text-right px-4 py-2 body body-weight-medium">Group stage</th>
                      <th className="text-right px-4 py-2 body body-weight-medium">Knockouts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCORING_ROWS.map((row, i) => (
                      <tr
                        key={row.label}
                        className={i % 2 === 0 ? "" : "bg-[color:var(--color-surface-secondary)]/30"}
                      >
                        <td className="px-4 py-2.5">{row.label}</td>
                        <td className="px-4 py-2.5 text-right code code-size-medium tabular-nums">{row.group}</td>
                        <td className="px-4 py-2.5 text-right code code-size-medium tabular-nums text-[color:var(--color-action-primary-cta)]">
                          {row.knockout}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="body body-size-small mt-3 text-[color:var(--color-text-tertiary)]">
                Example: predicting <span className="code">2–1</span> for an England vs. France semi-final that ends <span className="code">2–1</span> earns 6 points. Predicting <span className="code">3–0</span> earns 2.
              </p>
            </TabsContent>

            <TabsContent value="schedule">
              <ol className="flex flex-col">
                {KEY_DATES.map((entry, i) => (
                  <li
                    key={entry.label}
                    className="flex items-center gap-4 py-2 border-b border-[color:var(--color-border-secondary)] last:border-b-0"
                  >
                    <span className="code code-size-medium tabular-nums w-24 text-[color:var(--color-text-secondary)]">
                      {entry.date}
                    </span>
                    <span className="size-1.5 rounded-full bg-[color:var(--color-action-primary-cta)]" />
                    <span className="body body-size-medium">{entry.label}</span>
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
                <div className="rounded-lg border border-[color:var(--color-category-border-green)] bg-[color:var(--color-category-bg-green)] p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 body body-weight-medium body-size-medium text-[color:var(--color-category-surface-green)]">
                    <Flag className="size-4" /> You&apos;re in
                  </div>
                  <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                    Anyone with an <code className="code code-size-small">@{ALLOWED_EMAIL_DOMAIN}</code> address. Sign in with the work email you already use; we&apos;ll email a one-tap link.
                  </p>
                </div>
                <div className="rounded-lg border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 body body-weight-medium body-size-medium text-[color:var(--color-text-secondary)]">
                    <Lock className="size-4" /> No password, no account
                  </div>
                  <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                    Magic-link sign-in. Predictions are private until kickoff, then visible on the leaderboard. Admins can fix mistakes; nobody else.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </section>

      <footer className="border-t border-[color:var(--color-border-primary)] py-5 bg-background">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-sm text-[color:var(--color-text-secondary)]">
          <span>Built for the Novee team. Not affiliated with FIFA.</span>
          <span className="flex items-center gap-2">
            <VeeVeeLogo size={16} /> Novee
          </span>
        </div>
      </footer>
    </main>
  );
}

function FeatureBlock({
  icon,
  color,
  title,
  body,
}: {
  icon: React.ReactNode;
  color: "brand" | "green" | "blue";
  title: string;
  body: string;
}) {
  const bgVar = `var(--color-category-bg-${color})`;
  const surfaceVar = `var(--color-category-surface-${color})`;
  return (
    <Card className="py-4 gap-2">
      <CardHeader>
        <div
          className="size-9 rounded-md grid place-items-center"
          style={{ backgroundColor: bgVar, color: surfaceVar }}
        >
          {icon}
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}
