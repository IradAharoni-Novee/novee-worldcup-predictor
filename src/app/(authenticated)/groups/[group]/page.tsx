import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { GroupPredictorForm } from "@/components/predictor/group-predictor-form";
import { SubmissionDeadline } from "@/components/predictor/submission-deadline";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { getScoringConfig } from "@/lib/leaderboard";
import { getGroupLockTimes } from "@/lib/locks";
import { isLocked } from "@/lib/format";

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];

export default async function GroupPredictionPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  if (!/^[A-L]$/.test(group)) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const matches = await prisma.match.findMany({
    where: { stage: "GROUP", group },
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, flag: true } },
      awayTeam: { select: { id: true, name: true, code: true, flag: true } },
    },
  });
  if (matches.length === 0) notFound();

  const teamMap = new Map<string, { id: string; name: string; code: string; flag: string | null }>();
  for (const m of matches) {
    if (m.homeTeam) teamMap.set(m.homeTeam.id, m.homeTeam);
    if (m.awayTeam) teamMap.set(m.awayTeam.id, m.awayTeam);
  }
  const teams = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const [prediction, lockTimes] = await Promise.all([
    prisma.groupPrediction.findUnique({
      where: { userId_group: { userId, group } },
    }),
    getGroupLockTimes(),
  ]);

  const lock = lockTimes.get(group);
  const locked = lock ? isLocked(lock) : false;
  const allFinished = matches.every((m) => m.status === "FINISHED");
  const standings = allFinished
    ? computeGroupStandings(
        matches.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        }))
      )
    : null;

  const score =
    prediction && standings
      ? scoreGroupPrediction(prediction, standings, config)
      : null;

  return (
    <PageContainer title={`Group ${group}`}>
      {locked ? (
        <Card className="px-4 sm:px-6 py-4 mb-4 gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                Status
              </p>
              <p className="heading text-lg">
                Locked — first kickoff has passed
              </p>
            </div>
            {score && (
              <div className="text-right shrink-0">
                <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                  Points earned
                </p>
                <p className="heading text-2xl">{score.total}</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="mb-3 flex flex-col gap-1">
          <p className="body body-size-medium text-[color:var(--color-text-secondary)]">
            Predictions lock at this group&apos;s first kickoff.
          </p>
          {lock && <SubmissionDeadline deadline={lock} />}
        </div>
      )}

      {!locked && (
        <Card className="px-4 py-4 mb-4">
          <GroupPredictorForm
            group={group}
            teams={teams}
            initial={
              prediction
                ? {
                    team1stId: prediction.team1stId,
                    team2ndId: prediction.team2ndId,
                    team3rdId: prediction.team3rdId,
                    team4thId: prediction.team4thId,
                  }
                : null
            }
          />
        </Card>
      )}

      {locked && prediction && (
        <Card className="px-4 py-4 mb-4 gap-2">
          <h3 className="heading text-base">Your prediction</h3>
          <ol className="flex flex-col gap-1">
            {[prediction.team1stId, prediction.team2ndId, prediction.team3rdId, prediction.team4thId].map(
              (teamId, i) => {
                const team = teamMap.get(teamId);
                return (
                  <li key={i} className="flex items-center justify-between body body-size-medium">
                    <span className="flex items-center gap-2">
                      <span className="code code-size-medium tabular-nums w-8 text-[color:var(--color-text-tertiary)]">
                        {POSITION_LABELS[i]}
                      </span>
                      <span>{team?.name ?? "—"}</span>
                    </span>
                  </li>
                );
              }
            )}
          </ol>
        </Card>
      )}

      {standings && (
        <Card className="px-4 py-4 gap-2">
          <h3 className="heading text-base flex items-center justify-between">
            Final standings
            <Chip size="small" color="green" label="Finished" />
          </h3>
          <ol className="flex flex-col gap-1">
            {standings.map((s, i) => {
              const team = teamMap.get(s.teamId);
              return (
                <li
                  key={s.teamId}
                  className="flex items-center justify-between body body-size-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="code code-size-medium tabular-nums w-8 text-[color:var(--color-text-tertiary)]">
                      {POSITION_LABELS[i]}
                    </span>
                    <span>{team?.name ?? "—"}</span>
                  </span>
                  <span className="code code-size-small tabular-nums text-[color:var(--color-text-tertiary)]">
                    {s.points} pts · GD {s.gd >= 0 ? `+${s.gd}` : s.gd}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </PageContainer>
  );
}
