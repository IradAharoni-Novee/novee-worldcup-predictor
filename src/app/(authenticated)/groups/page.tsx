import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { GroupPredictorForm } from "@/components/predictor/group-predictor-form";
import {
  ThirdPlaceQualifiersForm,
  type Candidate,
} from "@/components/predictor/third-place-qualifiers-form";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { getScoringConfig } from "@/lib/leaderboard";
import { getGroupLockTimes } from "@/lib/locks";
import { isLocked, formatKickoff } from "@/lib/format";

type TeamLite = {
  id: string;
  name: string;
  code: string;
  flag: string | null;
};

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const groupMatches = await prisma.match.findMany({
    where: { stage: "GROUP", group: { not: null } },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, flag: true } },
      awayTeam: { select: { id: true, name: true, code: true, flag: true } },
    },
  });

  const groups = [...new Set(groupMatches.map((m) => m.group!).filter(Boolean))].sort();

  const teamsByGroup = new Map<string, Map<string, TeamLite>>();
  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (!m.group) continue;
    const teamMap = teamsByGroup.get(m.group) ?? new Map<string, TeamLite>();
    if (m.homeTeam) teamMap.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam) teamMap.set(m.awayTeam.id, m.awayTeam);
    teamsByGroup.set(m.group, teamMap);
    const list = matchesByGroup.get(m.group) ?? [];
    list.push(m);
    matchesByGroup.set(m.group, list);
  }

  const [myPredictions, myThirdPlacePicks, lockTimes] = await Promise.all([
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.thirdPlaceQualifierPick.findMany({
      where: { userId },
      select: { teamId: true },
    }),
    getGroupLockTimes(),
  ]);
  const predictionByGroup = new Map(myPredictions.map((p) => [p.group, p]));

  const now = new Date();

  // Build the third-place candidates from the user's group predictions.
  const thirdPlaceCandidates: Candidate[] = [];
  for (const group of groups) {
    const pred = predictionByGroup.get(group);
    if (!pred) continue;
    const teamMap = teamsByGroup.get(group);
    const team = teamMap?.get(pred.team3rdId);
    if (!team) continue;
    thirdPlaceCandidates.push({
      teamId: team.id,
      teamName: team.name,
      teamFlag: team.flag,
      group,
    });
  }
  // Drop any saved picks whose underlying group-3rd has since changed.
  const candidateIds = new Set(thirdPlaceCandidates.map((c) => c.teamId));
  const myThirdPlaceIds = myThirdPlacePicks
    .map((p) => p.teamId)
    .filter((id) => candidateIds.has(id));
  // Lock the third-place section once every group has kicked off.
  const allGroupsLocked =
    groups.length > 0 &&
    groups.every((g) => {
      const t = lockTimes.get(g);
      return t ? isLocked(t, now) : false;
    });

  return (
    <PageContainer title="Groups">
      <p className="body body-size-medium text-[color:var(--color-text-secondary)] mb-4">
        Rank all four teams in each group from 1st to 4th. Earn{" "}
        {config.groupExactPosition} points per team in the exact spot, plus{" "}
        {config.groupQualifiedHalf} per team in the correct half (top-2 vs bottom-2).
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const lock = lockTimes.get(group);
          const locked = lock ? isLocked(lock, now) : false;
          const pred = predictionByGroup.get(group);
          const matches = matchesByGroup.get(group) ?? [];
          const teamMap = teamsByGroup.get(group) ?? new Map<string, TeamLite>();
          const teams = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
          const allFinished = matches.length > 0 && matches.every((m) => m.status === "FINISHED");

          let pointsEarned: number | null = null;
          let standingsList: string[] | null = null;
          if (pred && allFinished) {
            const standings = computeGroupStandings(matches);
            pointsEarned = scoreGroupPrediction(pred, standings, config).total;
            standingsList = standings.map((s) => teamMap.get(s.teamId)?.name ?? "—");
          }

          return (
            <Card key={group} className="px-4 py-4 gap-3">
              <div className="flex items-center justify-between">
                <span className="heading text-lg">Group {group}</span>
                <div className="flex items-center gap-2">
                  {locked ? (
                    <Chip
                      size="small"
                      color="slate"
                      label={
                        <span className="flex items-center gap-1">
                          <Lock className="size-3" />
                          Locked
                        </span>
                      }
                    />
                  ) : (
                    <Chip
                      size="small"
                      color={pred ? "green" : "amber"}
                      label={pred ? "Ranked" : "Open"}
                    />
                  )}
                  <Link
                    href={`/groups/${group}`}
                    className="inline-flex items-center gap-1 body body-size-small text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
                    aria-label={`Group ${group} details`}
                  >
                    Details
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {teams.length < 4 ? (
                <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
                  Group not seeded yet.
                </p>
              ) : locked ? (
                <LockedGroupSummary
                  teams={teams}
                  pred={pred}
                  pointsEarned={pointsEarned}
                  standingsList={standingsList}
                />
              ) : (
                <GroupPredictorForm
                  group={group}
                  teams={teams}
                  initial={
                    pred
                      ? {
                          team1stId: pred.team1stId,
                          team2ndId: pred.team2ndId,
                          team3rdId: pred.team3rdId,
                          team4thId: pred.team4thId,
                        }
                      : null
                  }
                />
              )}

              <div className="body body-size-small text-[color:var(--color-text-tertiary)] flex items-center justify-between border-t border-[color:var(--color-border-secondary)] pt-2">
                <span>
                  {locked
                    ? "First kickoff has passed"
                    : lock
                      ? `Locks ${formatKickoff(lock)}`
                      : "Unscheduled"}
                </span>
                {pointsEarned !== null ? (
                  <span className="body-weight-medium text-[color:var(--color-accent-success)]">
                    {pointsEarned} pt{pointsEarned === 1 ? "" : "s"}
                  </span>
                ) : pred && !locked ? (
                  <span>Saved</span>
                ) : null}
              </div>
            </Card>
          );
        })}
        {groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)] md:col-span-2 xl:col-span-3">
            No groups configured yet.
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <section className="mt-8">
          <h2 className="heading text-lg mb-1">Best third-place qualifiers</h2>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] mb-3">
            With 12 groups of 4, only 24 teams advance directly. The bracket
            fills its remaining 8 R32 spots with the best 8 of the 12
            third-placed teams — picked across groups by points → GD → GF →
            head-to-head. Tell us which 8 you think advance.
          </p>
          <Card className="px-4 py-4">
            <ThirdPlaceQualifiersForm
              candidates={thirdPlaceCandidates}
              initialTeamIds={myThirdPlaceIds}
              locked={allGroupsLocked}
            />
          </Card>
        </section>
      )}
    </PageContainer>
  );
}

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];

function LockedGroupSummary({
  teams,
  pred,
  pointsEarned,
  standingsList,
}: {
  teams: TeamLite[];
  pred:
    | {
        team1stId: string;
        team2ndId: string;
        team3rdId: string;
        team4thId: string;
      }
    | undefined;
  pointsEarned: number | null;
  standingsList: string[] | null;
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  if (!pred) {
    return (
      <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
        No ranking submitted before kickoff.
      </p>
    );
  }
  const picks = [pred.team1stId, pred.team2ndId, pred.team3rdId, pred.team4thId];
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1">
        {picks.map((teamId, i) => {
          const team = teamById.get(teamId);
          const actual = standingsList?.[i];
          const correctHere = actual === team?.name;
          return (
            <li
              key={i}
              className="flex items-center gap-2 body body-size-small"
            >
              <span className="code code-size-small tabular-nums w-8 text-[color:var(--color-text-tertiary)]">
                {POSITION_LABELS[i]}
              </span>
              {team?.flag && (
                <img
                  src={team.flag}
                  alt=""
                  className="w-5 h-3.5 rounded-sm object-cover"
                />
              )}
              <span
                className={
                  correctHere
                    ? "text-[color:var(--color-accent-success)] body-weight-medium"
                    : ""
                }
              >
                {team?.name ?? "—"}
              </span>
            </li>
          );
        })}
      </ol>
      {pointsEarned !== null && (
        <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
          {pointsEarned > 0
            ? `Scored ${pointsEarned} point${pointsEarned === 1 ? "" : "s"}.`
            : "No points scored."}
        </span>
      )}
    </div>
  );
}
