import { prisma } from "@/lib/prisma";
import { scorePrediction } from "@/lib/scoring";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { computeGroupStandings } from "@/lib/group-standings";
import { getScoringConfig } from "@/lib/leaderboard";
import { NOVEE_VOICE_TUNING } from "@/lib/veevee-voice";

export type Achievement = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
};

type Outcome = "H" | "A" | "D";

function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

/**
 * Compute every achievement for a single user from finished predictions.
 * Returns the full list, with `earned` flags — caller decides whether to show
 * locked badges as ghosted chips or hide them entirely.
 */
export async function computeAchievementsForUser(
  userId: string
): Promise<Achievement[]> {
  const config = await getScoringConfig();

  const [predictions, groupPredictions, groupMatches] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            id: true,
            stage: true,
            homeScore: true,
            awayScore: true,
            status: true,
            kickoff: true,
          },
        },
      },
      orderBy: { match: { kickoff: "asc" } },
    }),
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: {
        id: true,
        group: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        status: true,
        kickoff: true,
      },
    }),
  ]);

  const lucky7 = predictions.some((p) => {
    if (p.match.status !== "FINISHED") return false;
    if (p.match.homeScore == null || p.match.awayScore == null) return false;
    if (p.match.homeScore + p.match.awayScore < 7) return false;
    return (
      p.homeScore === p.match.homeScore && p.awayScore === p.match.awayScore
    );
  });

  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (!m.group) continue;
    const list = matchesByGroup.get(m.group) ?? [];
    list.push(m);
    matchesByGroup.set(m.group, list);
  }
  const groupSage = groupPredictions.some((gp) => {
    const matches = matchesByGroup.get(gp.group) ?? [];
    if (matches.length === 0) return false;
    if (!matches.every((m) => m.status === "FINISHED")) return false;
    const standings = computeGroupStandings(matches);
    return scoreGroupPrediction(gp, standings, config).exact === 4;
  });

  const groupMatchIdSet = new Set(groupMatches.map((m) => m.id));
  const firstKickoff = groupMatches.length
    ? Math.min(...groupMatches.map((m) => m.kickoff.getTime()))
    : Number.MAX_SAFE_INTEGER;
  const inBeforeKickoff = predictions.filter(
    (p) =>
      groupMatchIdSet.has(p.match.id) &&
      p.submittedAt.getTime() < firstKickoff
  );
  const couchCoach =
    groupMatches.length > 0 && inBeforeKickoff.length >= groupMatchIdSet.size;

  const finishedSorted = predictions
    .filter(
      (p) =>
        p.match.status === "FINISHED" &&
        p.match.homeScore != null &&
        p.match.awayScore != null
    )
    .sort(
      (a, b) => a.match.kickoff.getTime() - b.match.kickoff.getTime()
    );
  let current = 0;
  let best = 0;
  for (const p of finishedSorted) {
    const pts = scorePrediction(p, p.match, config);
    if (pts > 0) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  const streak5 = best >= 5;
  const streak10 = best >= 10;

  const contrarian = await detectContrarian(predictions);

  const achievements: Achievement[] = [
    {
      id: "lucky7",
      label: "Lucky 7",
      description: "Exact score on a 7+ goal match.",
      earned: lucky7,
    },
    {
      id: "groupSage",
      label: "Group Sage",
      description: "Nailed an entire group's ranking.",
      earned: groupSage,
    },
    {
      id: "couchCoach",
      label: "Couch Coach",
      description: "Every group-stage match predicted before kickoff #1.",
      earned: couchCoach,
    },
    {
      id: "contrarian",
      label: "Contrarian",
      description: "Exact score on a match <10% of the room called.",
      earned: contrarian,
    },
    {
      id: "streak5",
      label: "Streak 5",
      description: "Five consecutive correct outcomes.",
      earned: streak5,
    },
    {
      id: "streak10",
      label: "Streak 10",
      description: "Ten consecutive correct outcomes.",
      earned: streak10,
    },
  ];

  if (NOVEE_VOICE_TUNING.personName) {
    achievements.push({
      id: "personAward",
      label: `The ${NOVEE_VOICE_TUNING.personName} Award`,
      description: `Earned by anyone bold enough to lock in a tournament winner pick. ${NOVEE_VOICE_TUNING.personName} would (mostly) approve.`,
      earned: (await prisma.tournamentWinnerPrediction.findUnique({
        where: { userId },
        select: { id: true },
      })) !== null,
    });
  }

  return achievements;
}

type PredWithMatch = {
  homeScore: number;
  awayScore: number;
  match: {
    id: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
};

async function detectContrarian(predictions: PredWithMatch[]): Promise<boolean> {
  const exactMatches: { matchId: string; winner: Outcome }[] = [];
  for (const p of predictions) {
    if (p.match.status !== "FINISHED") continue;
    if (p.match.homeScore == null || p.match.awayScore == null) continue;
    if (p.homeScore !== p.match.homeScore || p.awayScore !== p.match.awayScore) {
      continue;
    }
    exactMatches.push({
      matchId: p.match.id,
      winner: outcomeOf(p.match.homeScore, p.match.awayScore),
    });
  }
  if (exactMatches.length === 0) return false;

  const allPicks = await prisma.prediction.findMany({
    where: { matchId: { in: exactMatches.map((m) => m.matchId) } },
    select: { matchId: true, homeScore: true, awayScore: true },
  });
  const byMatch = new Map<string, { homeScore: number; awayScore: number }[]>();
  for (const pick of allPicks) {
    const list = byMatch.get(pick.matchId) ?? [];
    list.push({ homeScore: pick.homeScore, awayScore: pick.awayScore });
    byMatch.set(pick.matchId, list);
  }
  for (const { matchId, winner } of exactMatches) {
    const picks = byMatch.get(matchId) ?? [];
    if (picks.length < 5) continue;
    const winners = picks.filter(
      (x) => outcomeOf(x.homeScore, x.awayScore) === winner
    ).length;
    if (winners / picks.length <= 0.1) return true;
  }
  return false;
}
