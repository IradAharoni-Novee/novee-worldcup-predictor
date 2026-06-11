import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import { scorePrediction } from "@/lib/scoring";
import { getScoringConfig } from "@/lib/leaderboard";
import { veeveeLine } from "@/lib/veevee-voice";

export const metadata = {
  title: "The Cosmos · VeeVee",
  description: "An alternate timeline that should not exist.",
};

export default async function CosmosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const predictions = await prisma.prediction.findMany({
    where: { userId },
    include: {
      match: {
        select: {
          stage: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      },
    },
  });

  let thisTimeline = 0;
  let mirror = 0;
  let scored = 0;
  for (const p of predictions) {
    if (p.match.status !== "FINISHED") continue;
    scored += 1;
    thisTimeline += scorePrediction(
      { homeScore: p.homeScore, awayScore: p.awayScore },
      {
        stage: p.match.stage,
        homeScore: p.match.homeScore,
        awayScore: p.match.awayScore,
      },
      config
    );
    mirror += scorePrediction(
      { homeScore: p.awayScore, awayScore: p.homeScore },
      {
        stage: p.match.stage,
        homeScore: p.match.homeScore,
        awayScore: p.match.awayScore,
      },
      config
    );
  }

  const delta = mirror - thisTimeline;
  const verdict =
    scored === 0
      ? "No matches have finished yet. The mirror is still cooling."
      : delta > 0
        ? `In the mirror, you'd be ${delta} point${delta === 1 ? "" : "s"} ahead. Choose wisely.`
        : delta < 0
          ? `In the mirror, you'd be ${-delta} point${delta === -1 ? "" : "s"} behind. VeeVee respects your conviction.`
          : "Mirror matches this timeline, point for point. Eerie.";

  return (
    <PageContainer title="The Cosmos">
      <Card className="px-6 py-6 gap-4">
        <p className="italic text-[color:var(--color-text-tertiary)]">
          {veeveeLine("emptyMe", userId)}
        </p>
        <p className="body body-size-medium">
          You found the hidden room. VeeVee has been doing the math in here.
          Every prediction you&apos;ve made, scored against an alternate timeline
          where you flipped home and away on every match.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Stat label="This timeline" value={thisTimeline} />
          <Stat label="Mirror timeline" value={mirror} />
        </div>
        <p className="body body-size-medium">{verdict}</p>
        <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
          Based on {scored} finished match{scored === 1 ? "" : "es"}.{" "}
          <Link
            href="/me"
            className="text-[color:var(--color-action-primary-cta)] underline"
          >
            Back to your predictions
          </Link>
          .
        </p>
      </Card>
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="body body-size-small text-[color:var(--color-text-secondary)]">
        {label}
      </p>
      <p className="heading text-3xl tabular-nums">{value}</p>
    </div>
  );
}
