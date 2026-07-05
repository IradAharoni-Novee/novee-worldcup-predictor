import type { Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/retry";
import { projectR32Slots } from "@/lib/r32-projection";
import {
  buildKnockoutResults,
  determinedMatchupTeams,
  liveKnockoutMatchup,
  type KnockoutMatchup,
} from "@/lib/knockout-projection";

type MatchLite = {
  fdId: number;
  stage: Stage;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

type TeamDisplay = {
  id: string;
  name: string;
  code: string;
  flag: string | null;
};

export type LiveKnockoutResolution = {
  matchup: KnockoutMatchup;
  teamsById: ReadonlyMap<string, TeamDisplay>;
};

/**
 * Resolve one knockout fixture's current matchup from live group + knockout
 * results, walking the same feeder cascade the bracket uses so each round rolls
 * forward as the round below is decided. Returns null for a group match or a
 * fixture whose teams are both official (render those directly). The returned
 * `teamsById` covers every team so callers can map the resolved ids to display.
 */
export async function loadLiveKnockoutMatchup(
  match: MatchLite
): Promise<LiveKnockoutResolution | null> {
  if (match.stage === "GROUP" || (match.homeTeamId && match.awayTeamId)) {
    return null;
  }
  const [groupMatches, knockoutMatches, teams] = await withRetry(() =>
    Promise.all([
      prisma.match.findMany({
        where: { stage: "GROUP", group: { not: null } },
        select: {
          group: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
        },
      }),
      prisma.match.findMany({
        where: { stage: { not: "GROUP" } },
        select: {
          fdId: true,
          stage: true,
          homeTeamId: true,
          awayTeamId: true,
          advancingTeamId: true,
        },
      }),
      prisma.team.findMany({
        select: { id: true, name: true, code: true, flag: true },
      }),
    ])
  );
  const teamsById = new Map(teams.map((t) => [t.id, t] as const));
  const matchup = liveKnockoutMatchup(
    match,
    projectR32Slots(
      groupMatches.map((m) => ({ ...m, group: m.group as string }))
    ),
    (teamId) => teamsById.get(teamId)?.name,
    buildKnockoutResults(knockoutMatches)
  );
  return matchup ? { matchup, teamsById } : null;
}

/**
 * The two teams a knockout fixture is actually contested between, resolved from
 * live results, or null while the matchup is still a group-standings projection
 * or only partly known. Lets the shootout-winner pick be validated for a fixture
 * the feed hasn't formally populated yet but whose teams are already decided by
 * prior-round results.
 */
export async function resolveDeterminedKnockoutTeams(
  match: MatchLite
): Promise<{ homeTeamId: string; awayTeamId: string } | null> {
  const resolved = await loadLiveKnockoutMatchup(match);
  return determinedMatchupTeams(resolved?.matchup ?? null);
}
