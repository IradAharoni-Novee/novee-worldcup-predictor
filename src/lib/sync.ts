import { MatchStatus, Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupMatches, type FdMatch } from "@/lib/football-data";

function mapStage(stage: FdMatch["stage"]): Stage {
  switch (stage) {
    case "GROUP_STAGE":
      return Stage.GROUP;
    case "LAST_32":
      return Stage.R32;
    case "LAST_16":
    case "ROUND_OF_16":
      return Stage.R16;
    case "QUARTER_FINALS":
      return Stage.QF;
    case "SEMI_FINALS":
      return Stage.SF;
    case "THIRD_PLACE":
      return Stage.THIRD;
    case "FINAL":
      return Stage.FINAL;
  }
}

function mapStatus(status: FdMatch["status"]): MatchStatus {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return MatchStatus.LIVE;
    case "FINISHED":
      return MatchStatus.FINISHED;
    default:
      return MatchStatus.SCHEDULED;
  }
}

function groupCode(group: string | null): string | null {
  if (!group) return null;
  // football-data.org returns "GROUP_A" (v4); older payloads use "Group A".
  // Normalise both to a single letter.
  const m = /^(?:Group\s+|GROUP_)([A-Z])$/.exec(group);
  return m?.[1] ?? group;
}

export type SyncResult = {
  teamsUpserted: number;
  matchesUpserted: number;
};

export async function syncFromFootballData(): Promise<SyncResult> {
  const matches = await fetchWorldCupMatches();

  // Dedupe teams across matches so we hit the DB once per team
  const teamsById = new Map<number, FdMatch["homeTeam"]>();
  for (const m of matches) {
    if (m.homeTeam?.id) teamsById.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam?.id) teamsById.set(m.awayTeam.id, m.awayTeam);
  }

  for (const t of teamsById.values()) {
    await prisma.team.upsert({
      where: { fdId: t.id },
      create: {
        fdId: t.id,
        name: t.name,
        code: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? `T${t.id}`,
        flag: t.crest,
      },
      update: {
        name: t.name,
        code: t.tla ?? t.shortName?.slice(0, 3).toUpperCase() ?? `T${t.id}`,
        flag: t.crest,
      },
    });
  }

  // Build a map: fdTeamId -> our Team.id
  const allTeams = await prisma.team.findMany({
    where: { fdId: { in: Array.from(teamsById.keys()) } },
    select: { id: true, fdId: true },
  });
  const teamIdByFd = new Map(allTeams.map((t) => [t.fdId, t.id]));

  for (const m of matches) {
    const homeId = m.homeTeam?.id ? teamIdByFd.get(m.homeTeam.id) ?? null : null;
    const awayId = m.awayTeam?.id ? teamIdByFd.get(m.awayTeam.id) ?? null : null;
    await prisma.match.upsert({
      where: { fdId: m.id },
      create: {
        fdId: m.id,
        stage: mapStage(m.stage),
        group: groupCode(m.group),
        kickoff: new Date(m.utcDate),
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        status: mapStatus(m.status),
      },
      update: {
        stage: mapStage(m.stage),
        group: groupCode(m.group),
        kickoff: new Date(m.utcDate),
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        status: mapStatus(m.status),
      },
    });
  }

  return { teamsUpserted: teamsById.size, matchesUpserted: matches.length };
}
