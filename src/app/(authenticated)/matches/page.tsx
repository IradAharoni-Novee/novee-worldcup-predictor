import { PageContainer } from "@/components/shell/page-container";
import { MatchCard } from "@/components/match/match-card";
import type { TeamLite } from "@/components/match/team-row";
import { LiveScoreRefresher } from "@/components/match/live-score-refresher";
import { JumpToRecent } from "@/components/match/jump-to-recent";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreMatchTotal } from "@/lib/scoring";
import { isMatchLive } from "@/lib/format";
import { projectR32Slots } from "@/lib/r32-projection";
import { liveKnockoutMatchup } from "@/lib/knockout-projection";
import { withRetry } from "@/lib/retry";
import { veeveeLine } from "@/lib/veevee-voice";

export default async function MatchesPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [matches, teams] = await withRetry(() =>
    Promise.all([
      prisma.match.findMany({
        orderBy: { kickoff: "asc" },
        include: {
          homeTeam: { select: { name: true, code: true, flag: true } },
          awayTeam: { select: { name: true, code: true, flag: true } },
          predictions: userId
            ? {
                where: { userId },
                select: {
                  homeScore: true,
                  awayScore: true,
                  shootoutWinnerTeamId: true,
                  note: true,
                },
              }
            : false,
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, code: true, flag: true },
      }),
    ])
  );

  // Knockout fixtures are filled from live group standings: the Round of 32
  // shows its projected teams (e.g. "Mexico v Canada"), the Round of 16 the team
  // options feeding each side, and later rounds the feeding match ("Winner of
  // R16 #1"). Resolved per request from the group results everyone sees.
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const r32Slots = projectR32Slots(
    matches
      .filter((m) => m.stage === "GROUP" && m.group)
      .map((m) => ({
        group: m.group as string,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }))
  );
  const teamName = (id: string) => teamsById.get(id)?.name;

  function liveTeams(m: (typeof matches)[number]): {
    homeTeam: TeamLite;
    awayTeam: TeamLite;
    homeFallback?: string;
    awayFallback?: string;
    provisional: boolean;
    matchNo: number | null;
  } {
    const live = liveKnockoutMatchup(
      { fdId: m.fdId, stage: m.stage, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId },
      r32Slots,
      teamName
    );
    if (!live) {
      return {
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        provisional: false,
        matchNo: null,
      };
    }
    return {
      homeTeam: live.home.teamId ? teamsById.get(live.home.teamId) ?? null : null,
      awayTeam: live.away.teamId ? teamsById.get(live.away.teamId) ?? null : null,
      homeFallback: live.home.label,
      awayFallback: live.away.label,
      provisional: live.provisional,
      matchNo: live.matchNo,
    };
  }

  const now = new Date();
  const hasLiveMatch = matches.some((m) =>
    isMatchLive(m.status, m.kickoff, now)
  );

  // Matches are ordered by kickoff, so finished games cluster at the top. Find
  // the first upcoming/live one and offer a jump only when finished games
  // precede it.
  const firstUpcomingIndex = matches.findIndex((m) => m.status !== "FINISHED");
  const canJumpToRecent = firstUpcomingIndex > 0;

  function render(list: typeof matches) {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
          <p className="italic text-[color:var(--color-text-tertiary)]">
            {veeveeLine("emptyMatches", userId)}
          </p>
        </div>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((m, idx) => {
          const prediction = m.predictions?.[0] ?? null;
          const points =
            m.status === "FINISHED"
              ? scoreMatchTotal(prediction, {
                  stage: m.stage,
                  homeTeamId: m.homeTeamId,
                  awayTeamId: m.awayTeamId,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                  advancingTeamId: m.advancingTeamId,
                })
              : null;
          const { homeTeam, awayTeam, homeFallback, awayFallback, provisional, matchNo } =
            liveTeams(m);
          return (
            <MatchCard
              key={m.id}
              id={m.id}
              stage={m.stage}
              group={m.group}
              matchNo={matchNo}
              kickoff={m.kickoff}
              venue={m.venue}
              city={m.city}
              country={m.country}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeTeamId={m.homeTeamId}
              awayTeamId={m.awayTeamId}
              homeFallback={homeFallback}
              awayFallback={awayFallback}
              provisional={provisional}
              homeScore={m.homeScore}
              awayScore={m.awayScore}
              penaltyHome={m.penaltyHome}
              penaltyAway={m.penaltyAway}
              status={m.status}
              prediction={prediction}
              points={points}
              recentAnchor={canJumpToRecent && idx === firstUpcomingIndex}
              odds={
                m.oddsHome != null && m.oddsDraw != null && m.oddsAway != null
                  ? { home: m.oddsHome, draw: m.oddsDraw, away: m.oddsAway }
                  : null
              }
            />
          );
        })}
      </div>
    );
  }

  return (
    <PageContainer title="Matches">
      {hasLiveMatch && <LiveScoreRefresher />}
      {canJumpToRecent && <JumpToRecent />}
      {render(matches)}
    </PageContainer>
  );
}
