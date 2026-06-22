import { PageContainer } from "@/components/shell/page-container";
import { MatchCard } from "@/components/match/match-card";
import type { TeamLite } from "@/components/match/team-row";
import { LiveScoreRefresher } from "@/components/match/live-score-refresher";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scorePrediction } from "@/lib/scoring";
import { isMatchLive } from "@/lib/format";
import { liveR32Matchup, projectR32ByFdId } from "@/lib/r32-projection";
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
                select: { homeScore: true, awayScore: true, note: true },
              }
            : false,
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, code: true, flag: true },
      }),
    ])
  );

  // Round of 32 fixtures are filled from live group standings, so a knockout
  // card shows its projected matchup (e.g. "Mexico v Canada") before FIFA sets
  // the teams. Resolved per request from the same group results everyone sees.
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const r32ByFd = projectR32ByFdId(
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

  function liveTeams(m: (typeof matches)[number]): {
    homeTeam: TeamLite;
    awayTeam: TeamLite;
    homeFallback?: string;
    awayFallback?: string;
    provisional: boolean;
  } {
    const live =
      m.stage === "R32"
        ? liveR32Matchup(
            m.fdId,
            { homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId },
            r32ByFd
          )
        : null;
    if (!live) {
      return {
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        provisional: false,
      };
    }
    return {
      homeTeam: live.home.teamId ? teamsById.get(live.home.teamId) ?? null : null,
      awayTeam: live.away.teamId ? teamsById.get(live.away.teamId) ?? null : null,
      homeFallback: live.home.label,
      awayFallback: live.away.label,
      provisional: live.provisional,
    };
  }

  const now = new Date();
  const hasLiveMatch = matches.some((m) =>
    isMatchLive(m.status, m.kickoff, now)
  );

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
        {list.map((m) => {
          const prediction = m.predictions?.[0] ?? null;
          const points =
            m.status === "FINISHED"
              ? scorePrediction(prediction, {
                  stage: m.stage,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                })
              : null;
          const { homeTeam, awayTeam, homeFallback, awayFallback, provisional } =
            liveTeams(m);
          return (
            <MatchCard
              key={m.id}
              id={m.id}
              stage={m.stage}
              group={m.group}
              kickoff={m.kickoff}
              venue={m.venue}
              city={m.city}
              country={m.country}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeFallback={homeFallback}
              awayFallback={awayFallback}
              provisional={provisional}
              homeScore={m.homeScore}
              awayScore={m.awayScore}
              status={m.status}
              prediction={prediction}
              points={points}
            />
          );
        })}
      </div>
    );
  }

  return (
    <PageContainer title="Matches">
      {hasLiveMatch && <LiveScoreRefresher />}
      {render(matches)}
    </PageContainer>
  );
}
