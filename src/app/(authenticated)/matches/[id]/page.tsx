import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Chip, type ChipColor } from "@/components/ui/chip";
import { PredictionForm } from "@/components/match/prediction-form";
import { PageContainer } from "@/components/shell/page-container";
import { formatKickoff, isLocked, stageLabel } from "@/lib/format";
import { scorePrediction } from "@/lib/scoring";
import type { Stage } from "@prisma/client";
import { veeveeLine } from "@/lib/veevee-voice";
import { getPickAggregates } from "@/lib/pick-aggregates";
import { PickHistogram } from "@/components/match/pick-histogram";

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
  const locationParts = [match.city, match.country].filter(Boolean);
  const points =
    match.status === "FINISHED"
      ? scorePrediction(prediction, {
          stage: match.stage,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        })
      : null;

  // After kickoff, surface everyone's hot takes (anonymized) and the pick
  // histogram. Hot takes skip the current user's note since it's shown above
  // in the locked summary.
  const [hotTakes, aggregates] = await Promise.all([
    locked
      ? prisma.prediction.findMany({
          where: {
            matchId: id,
            note: { not: null },
            userId: { not: userId },
          },
          select: {
            id: true,
            note: true,
            homeScore: true,
            awayScore: true,
          },
          take: 50,
        })
      : Promise.resolve([]),
    locked
      ? getPickAggregates(id)
      : Promise.resolve({ total: 0, buckets: [] }),
  ]);

  const consensusForUser =
    prediction && aggregates.buckets[0]
      ? aggregates.buckets[0].homeScore === prediction.homeScore &&
        aggregates.buckets[0].awayScore === prediction.awayScore
      : false;
  const ownPickShare =
    prediction
      ? aggregates.buckets.find(
          (b) =>
            b.homeScore === prediction.homeScore &&
            b.awayScore === prediction.awayScore
        )?.percent ?? 0
      : 0;
  const contrarianFlavor = prediction && ownPickShare > 0 && ownPickShare < 5;
  const histogramVoice = consensusForUser
    ? veeveeLine("consensus", id)
    : contrarianFlavor
      ? veeveeLine("contrarian", id)
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

          {match.venue && (
            <div className="flex items-start justify-center gap-1.5 text-center body body-size-small text-[color:var(--color-text-secondary)] mb-4">
              <MapPin className="size-3.5 mt-0.5 shrink-0 text-[color:var(--color-text-tertiary)]" />
              <span>
                <span className="body-weight-medium">{match.venue}</span>
                {locationParts.length > 0 && (
                  <span className="text-[color:var(--color-text-tertiary)]">
                    {" · "}
                    {locationParts.join(", ")}
                  </span>
                )}
              </span>
            </div>
          )}

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

      {locked && aggregates.total > 0 && (
        <section className="mt-6">
          <h2 className="subheading subheading-size-large subheading-weight-medium mb-1">
            What the room picked
          </h2>
          {histogramVoice && (
            <p className="body body-size-small text-[color:var(--color-text-tertiary)] mb-3 italic">
              {histogramVoice}
            </p>
          )}
          <PickHistogram
            buckets={aggregates.buckets}
            total={aggregates.total}
            yourPick={
              prediction
                ? {
                    homeScore: prediction.homeScore,
                    awayScore: prediction.awayScore,
                  }
                : null
            }
            actual={
              match.homeScore != null && match.awayScore != null
                ? { homeScore: match.homeScore, awayScore: match.awayScore }
                : null
            }
          />
          <p className="body body-size-xsmall text-[color:var(--color-text-tertiary)] mt-2">
            Based on {aggregates.total} prediction
            {aggregates.total === 1 ? "" : "s"}.
          </p>
        </section>
      )}

      {locked && hotTakes.length > 0 && (
        <section className="mt-6">
          <h2 className="subheading subheading-size-large subheading-weight-medium mb-1">
            Hot takes from the room
          </h2>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] mb-3 italic">
            {veeveeLine("hotTakeReveal", id)}
          </p>
          <ul className="flex flex-col gap-2">
            {hotTakes.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-[color:var(--color-border-secondary)] px-4 py-2 body body-size-small flex items-center justify-between gap-3"
              >
                <span className="italic">&ldquo;{t.note}&rdquo;</span>
                <span className="code code-size-small tabular-nums text-[color:var(--color-text-tertiary)] shrink-0">
                  {t.homeScore}–{t.awayScore}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
        <span className="size-12 relative shrink-0">
          <Image
            src={team.flag}
            alt=""
            fill
            sizes="48px"
            className="rounded-md object-contain"
            unoptimized
          />
        </span>
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
