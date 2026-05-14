import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Chip, type ChipColor } from "@/components/ui/chip";
import { PredictionForm } from "@/components/match/prediction-form";
import { PageContainer } from "@/components/shell/page-container";
import { formatKickoff, isLocked, stageLabel } from "@/lib/format";
import { scorePrediction } from "@/lib/scoring";
import type { Stage } from "@prisma/client";

function stageChipColor(stage: Stage): ChipColor {
  switch (stage) {
    case "GROUP":
      return "slate";
    case "FINAL":
      return "brand";
    case "SF":
    case "THIRD":
      return "amber";
    case "QF":
      return "orange";
    default:
      return "blue";
  }
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { select: { name: true, code: true, flag: true } },
      awayTeam: { select: { name: true, code: true, flag: true } },
      predictions: { where: { userId } },
    },
  });
  if (!match) notFound();

  const prediction = match.predictions[0] ?? null;
  const locked = isLocked(match.kickoff) || match.status !== "SCHEDULED";
  const points =
    match.status === "FINISHED"
      ? scorePrediction(prediction, {
          stage: match.stage,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        })
      : null;

  return (
    <PageContainer title={stageLabel(match.stage, match.group)}>
      <Link
        href="/matches"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] mb-3"
      >
        <ArrowLeft className="size-3.5" /> Back to matches
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Chip
              size="small"
              color={stageChipColor(match.stage)}
              label={stageLabel(match.stage, match.group)}
            />
            <span className="body body-size-small text-[color:var(--color-text-secondary)]">
              {formatKickoff(match.kickoff)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 items-center gap-4 py-4">
            <TeamBlock team={match.homeTeam} />
            <div className="text-center">
              {match.status === "FINISHED" ? (
                <div className="code code-size-large text-4xl tabular-nums">
                  {match.homeScore}
                  <span className="mx-2 text-[color:var(--color-text-tertiary)]">
                    –
                  </span>
                  {match.awayScore}
                </div>
              ) : (
                <div className="heading text-2xl text-[color:var(--color-text-tertiary)]">
                  vs
                </div>
              )}
            </div>
            <TeamBlock team={match.awayTeam} />
          </div>

          {points != null && (
            <p className="text-center body body-size-medium mb-4">
              You earned{" "}
              <span className="font-semibold text-[color:var(--color-action-primary-cta)]">
                {points} point{points === 1 ? "" : "s"}
              </span>{" "}
              for this match.
            </p>
          )}

          <PredictionForm
            matchId={match.id}
            initial={prediction}
            locked={locked}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function TeamBlock({
  team,
}: {
  team: { name: string; code: string; flag: string | null } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {team?.flag ? (
        <Image
          src={team.flag}
          alt=""
          width={56}
          height={40}
          className="size-12 rounded-md object-contain"
          unoptimized
        />
      ) : (
        <div className="size-12 rounded-md bg-[color:var(--color-surface-emphasis)] grid place-items-center text-[color:var(--color-text-tertiary)]">
          ?
        </div>
      )}
      <span className="body body-weight-medium body-size-medium text-center">
        {team?.name ?? "TBD"}
      </span>
    </div>
  );
}
