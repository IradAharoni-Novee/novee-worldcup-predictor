import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, MapPin } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Chip, type ChipColor } from "@/components/ui/chip";
import { LiveBadge } from "@/components/match/live-badge";
import { LiveScoreRefresher } from "@/components/match/live-score-refresher";
import { PredictionForm } from "@/components/match/prediction-form";
import {
  LocalKickoff,
  SubmissionDeadline,
} from "@/components/predictor/submission-deadline";
import { PageContainer } from "@/components/shell/page-container";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";
import { isLocked, isMatchLive, losingSide, stageLabel } from "@/lib/format";
import { determinedMatchupTeams } from "@/lib/knockout-projection";
import { loadLiveKnockoutMatchup } from "@/lib/knockout-live";
import { withRetry } from "@/lib/retry";
import { isKnockout, scoreMatchTotal } from "@/lib/scoring";
import type { Stage } from "@prisma/client";
import { veeveeLine } from "@/lib/veevee-voice";
import { getScoringConfig } from "@/lib/leaderboard";
import { bucketScores } from "@/lib/pick-aggregates";
import { rankContenders } from "@/lib/match-contenders";
import { MatchContenders } from "@/components/match/match-contenders";
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

  const match = await withRetry(() =>
    prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: { select: { name: true, code: true, flag: true } },
        awayTeam: { select: { name: true, code: true, flag: true } },
        predictions: { where: { userId } },
      },
    })
  );
  if (!match) notFound();

  // A knockout fixture whose teams aren't set yet shows its live projection: the
  // Round of 32 its teams from current group standings, the Round of 16 the team
  // options per side, and later rounds the feeding match ("Winner of R16 #1").
  const liveKo = await resolveLiveKnockoutMatchup(match);
  const homeTeam = liveKo?.homeTeam ?? match.homeTeam;
  const awayTeam = liveKo?.awayTeam ?? match.awayTeam;

  const prediction = match.predictions[0] ?? null;
  const locked = isLocked(match.kickoff) || match.status !== "SCHEDULED";
  const live = isMatchLive(match.status, match.kickoff);
  const hasScore = match.homeScore != null && match.awayScore != null;
  // Show the scoreline for finished matches and for live matches once a score
  // has synced; a live match with no score yet still falls back to "vs".
  const showScore = hasScore && match.status !== "SCHEDULED";
  const loser = losingSide({
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    advancingTeamId: match.advancingTeamId,
  });
  const locationParts = [match.city, match.country].filter(Boolean);

  // Once locked, one query serves every room surface below: the contenders
  // ranking, the pick histogram, and the attributed hot takes. Before kickoff
  // other users' predictions stay private, so the fetch itself is gated.
  const [scoring, roomPredictions] = await withRetry(() =>
    Promise.all([
      getScoringConfig(),
      locked
        ? prisma.prediction.findMany({
            where: { matchId: id },
            select: {
              id: true,
              note: true,
              homeScore: true,
              awayScore: true,
              shootoutWinnerTeamId: true,
              userId: true,
              user: {
                select: { id: true, name: true, image: true, email: true },
              },
            },
          })
        : Promise.resolve([]),
    ])
  );

  const points =
    match.status === "FINISHED"
      ? scoreMatchTotal(
          prediction,
          {
            stage: match.stage,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            advancingTeamId: match.advancingTeamId,
          },
          scoring
        )
      : null;

  // A knockout left level at 120' but with an advancer was decided on penalties.
  const advancerName =
    isKnockout(match.stage) &&
    match.status === "FINISHED" &&
    hasScore &&
    match.homeScore === match.awayScore &&
    match.advancingTeamId != null
      ? match.advancingTeamId === match.homeTeamId
        ? homeTeam?.name ?? "Home"
        : match.advancingTeamId === match.awayTeamId
          ? awayTeam?.name ?? "Away"
          : null
      : null;

  // Post-kickoff room surfaces, all derived from the one predictions query.
  // Hot takes skip the current user's note since it's shown above in the
  // locked summary.
  const hotTakes = roomPredictions
    .filter((p) => p.note !== null && p.userId !== userId)
    .slice(0, 50);
  const aggregates = bucketScores(roomPredictions);
  const contenders = rankContenders(
    roomPredictions,
    {
      stage: match.stage,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      advancingTeamId: match.advancingTeamId,
    },
    scoring
  );
  // The two sides (once known), for labelling drawn picks' shootout calls.
  const contenderTeams: { id: string; code: string; name: string }[] = [];
  if (match.homeTeamId && match.homeTeam) {
    contenderTeams.push({
      id: match.homeTeamId,
      code: match.homeTeam.code,
      name: match.homeTeam.name,
    });
  }
  if (match.awayTeamId && match.awayTeam) {
    contenderTeams.push({
      id: match.awayTeamId,
      code: match.awayTeam.code,
      name: match.awayTeam.name,
    });
  }

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
      {live && <LiveScoreRefresher />}
      <Link
        href="/matches"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] mb-3"
      >
        <ArrowLeft className="size-3.5" /> Back to matches
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Chip
                size="small"
                color={stageChipColor(match.stage)}
                label={stageLabel(match.stage, match.group)}
              />
              {liveKo?.matchNo != null && (
                <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                  #{liveKo.matchNo}
                </span>
              )}
            </div>
            <span className="body body-size-small text-[color:var(--color-text-secondary)]">
              <LocalKickoff date={match.kickoff} />
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 items-center gap-4 py-4">
            <TeamBlock
              team={homeTeam}
              fallback={liveKo?.homeFallback}
              dim={loser === "home"}
            />
            <div className="flex flex-col items-center gap-1.5 text-center">
              {live && <LiveBadge />}
              {showScore ? (
                <div className="code code-size-large text-4xl tabular-nums">
                  <span
                    className={cn(
                      loser === "home" &&
                        "text-[color:var(--color-text-tertiary)]"
                    )}
                  >
                    {match.homeScore}
                  </span>
                  <span className="mx-2 text-[color:var(--color-text-tertiary)]">
                    –
                  </span>
                  <span
                    className={cn(
                      loser === "away" &&
                        "text-[color:var(--color-text-tertiary)]"
                    )}
                  >
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <div className="heading text-2xl text-[color:var(--color-text-tertiary)]">
                  vs
                </div>
              )}
            </div>
            <TeamBlock
              team={awayTeam}
              fallback={liveKo?.awayFallback}
              dim={loser === "away"}
            />
          </div>

          {match.penaltyHome != null && match.penaltyAway != null && (
            <p className="text-center body body-size-small text-[color:var(--color-text-tertiary)] mb-1">
              Penalties:{" "}
              <span className="code code-size-medium tabular-nums">
                {match.penaltyHome}–{match.penaltyAway}
              </span>
            </p>
          )}

          {advancerName && (
            <p className="text-center body body-size-small text-[color:var(--color-text-secondary)] mb-4">
              {advancerName} advanced on penalties
            </p>
          )}

          {liveKo?.provisional && (
            <div className="flex items-start justify-center gap-1.5 text-center body body-size-small text-[color:var(--color-text-tertiary)] italic mb-4">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <span>Projected from current group standings — not final.</span>
            </div>
          )}

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

          {!locked && (
            <div className="flex justify-center mb-3">
              <SubmissionDeadline deadline={match.kickoff} />
            </div>
          )}
          <PredictionForm
            matchId={match.id}
            initial={prediction}
            locked={locked}
            knockout={isKnockout(match.stage)}
            homeTeamId={liveKo?.homeTeamId ?? match.homeTeamId}
            awayTeamId={liveKo?.awayTeamId ?? match.awayTeamId}
            homeTeamName={homeTeam?.name ?? "Home"}
            awayTeamName={awayTeam?.name ?? "Away"}
          />
        </CardContent>
      </Card>

      {locked && contenders.length > 0 && (
        <section className="mt-6">
          <h2 className="subheading subheading-size-large subheading-weight-medium mb-1">
            Contenders
          </h2>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] mb-3 italic">
            {veeveeLine("contenders", id)}
          </p>
          <MatchContenders
            rows={contenders}
            currentUserId={userId}
            teams={contenderTeams}
          />
          {live && (
            <p className="body body-size-xsmall text-[color:var(--color-text-tertiary)] mt-2">
              {hasScore
                ? "Provisional — scored at the current scoreline; updates as the match plays out."
                : "Waiting for the first score sync — points land once a scoreline does."}
            </p>
          )}
        </section>
      )}

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
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/u/${t.user.id}`}
                    className="flex items-center gap-2 min-w-0 hover:underline shrink-0"
                  >
                    <UserAvatar
                      email={t.user.email}
                      name={t.user.name}
                      image={t.user.image}
                      size={24}
                    />
                    <span className="body-weight-medium truncate">
                      {t.user.name ?? t.user.email.split("@")[0]}
                    </span>
                  </Link>
                  <span className="italic truncate">&ldquo;{t.note}&rdquo;</span>
                </div>
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

type TeamLite = { name: string; code: string; flag: string | null } | null;

// For an undecided knockout fixture, resolve what to show from current group
// standings (same projection the bracket uses): projected teams for the Round
// of 32, team options for the Round of 16, and a feeding-match reference for
// later rounds. Returns null for a group match or an already-finalised fixture.
async function resolveLiveKnockoutMatchup(match: {
  stage: Stage;
  fdId: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
}): Promise<{
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  homeFallback: string;
  awayFallback: string;
  provisional: boolean;
  matchNo: number | null;
  // The ids the prediction form uses for its shootout-winner pick: null while
  // the matchup is still a group-standings projection, the resolved teams once
  // it is decided by prior-round results (see determinedMatchupTeams).
  homeTeamId: string | null;
  awayTeamId: string | null;
} | null> {
  const resolved = await loadLiveKnockoutMatchup(match);
  if (!resolved) return null;
  const { matchup, teamsById } = resolved;
  const determined = determinedMatchupTeams(matchup);
  return {
    homeTeam: matchup.home.teamId ? teamsById.get(matchup.home.teamId) ?? null : null,
    awayTeam: matchup.away.teamId ? teamsById.get(matchup.away.teamId) ?? null : null,
    homeFallback: matchup.home.label,
    awayFallback: matchup.away.label,
    provisional: matchup.provisional,
    matchNo: matchup.matchNo,
    homeTeamId: determined?.homeTeamId ?? null,
    awayTeamId: determined?.awayTeamId ?? null,
  };
}

function TeamBlock({
  team,
  dim = false,
  fallback = "TBD",
}: {
  team: { name: string; code: string; flag: string | null } | null;
  dim?: boolean;
  fallback?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 transition-opacity",
        dim && "opacity-45"
      )}
    >
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
      <span
        className={cn(
          "body body-weight-medium body-size-medium text-center",
          !team && "text-[color:var(--color-text-secondary)]"
        )}
      >
        {team?.name ?? fallback}
      </span>
    </div>
  );
}
