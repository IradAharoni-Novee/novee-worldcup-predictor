import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { formatKickoff, stageLabel } from "@/lib/format";
import { getScoringConfig } from "@/lib/leaderboard";
import { scorePrediction } from "@/lib/scoring";

export default async function MePage() {
  const session = await auth();
  const userId = session!.user.id;
  const config = await getScoringConfig();

  const predictions = await prisma.prediction.findMany({
    where: { userId },
    orderBy: { match: { kickoff: "asc" } },
    include: {
      match: {
        include: {
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  });

  const total = predictions.reduce((sum, p) => {
    return (
      sum +
      scorePrediction(
        { homeScore: p.homeScore, awayScore: p.awayScore },
        {
          stage: p.match.stage,
          homeScore: p.match.homeScore,
          awayScore: p.match.awayScore,
        },
        config
      )
    );
  }, 0);

  return (
    <PageContainer title="My predictions">
      <Card className="px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              Total points
            </p>
            <p className="heading text-3xl">{total}</p>
          </div>
          <div className="text-right">
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              Predictions submitted
            </p>
            <p className="heading text-3xl">{predictions.length}</p>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        {predictions.length === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
            You haven&apos;t submitted any predictions yet.{" "}
            <Link
              href="/matches"
              className="text-[color:var(--color-action-primary-cta)] underline"
            >
              Go pick some matches
            </Link>
            .
          </div>
        )}
        {predictions.map((p) => {
          const points = scorePrediction(
            { homeScore: p.homeScore, awayScore: p.awayScore },
            {
              stage: p.match.stage,
              homeScore: p.match.homeScore,
              awayScore: p.match.awayScore,
            },
            config
          );
          return (
            <Link
              key={p.id}
              href={`/matches/${p.match.id}`}
              className="block"
            >
              <Card className="py-3 gap-2 hover:border-[color:var(--color-border-hover)] transition-colors">
                <div className="px-4 flex items-center justify-between">
                  <Chip
                    size="small"
                    color="slate"
                    label={stageLabel(p.match.stage, p.match.group)}
                  />
                  <span className="body body-size-small text-[color:var(--color-text-secondary)]">
                    {formatKickoff(p.match.kickoff)}
                  </span>
                </div>
                <div className="px-4 flex items-center justify-between gap-3">
                  <span className="body body-size-medium truncate">
                    {p.match.homeTeam?.name ?? "TBD"} vs{" "}
                    {p.match.awayTeam?.name ?? "TBD"}
                  </span>
                  <span className="code code-size-medium tabular-nums">
                    {p.homeScore}–{p.awayScore}
                  </span>
                </div>
                <div className="px-4 flex items-center justify-between body body-size-small">
                  <span className="text-[color:var(--color-text-tertiary)]">
                    {p.match.status === "FINISHED"
                      ? `Actual: ${p.match.homeScore}–${p.match.awayScore}`
                      : p.match.status === "LIVE"
                        ? "Live"
                        : "Upcoming"}
                  </span>
                  {p.match.status === "FINISHED" && (
                    <span
                      className={
                        points > 0
                          ? "text-[color:var(--color-accent-success)] body-weight-medium"
                          : "text-[color:var(--color-text-tertiary)]"
                      }
                    >
                      {points} pt{points === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
