import { redirect } from "next/navigation";
import { Trophy, Goal } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import {
  GoldenBootPickerForm,
  WinnerPickerForm,
} from "@/components/predictor/awards-form";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import {
  getTournamentLockTime,
  isTournamentLocked,
} from "@/lib/locks";
import { formatKickoff } from "@/lib/format";
import { getScoringConfig } from "@/lib/leaderboard";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
  scoreAwards,
} from "@/lib/scoring-awards";

const POSITION_RANK: Record<string, number> = {
  Offence: 0,
  Offense: 0,
  Forward: 0,
  Attacker: 0,
  Midfield: 1,
  Defence: 2,
  Defense: 2,
  Goalkeeper: 3,
};

export default async function AwardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const [
    teams,
    players,
    winnerPick,
    goldenBootPick,
    lockTime,
    locked,
    actualWinnerSetting,
    actualGbSetting,
  ] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({
      include: { team: { select: { name: true, flag: true } } },
    }),
    prisma.tournamentWinnerPrediction.findUnique({ where: { userId } }),
    prisma.goldenBootPrediction.findUnique({ where: { userId } }),
    getTournamentLockTime(),
    isTournamentLocked(),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_WINNER } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT } }),
  ]);

  const actualWinnerTeamId =
    typeof actualWinnerSetting?.value === "string" ? actualWinnerSetting.value : null;
  const actualGoldenBootPlayerId =
    typeof actualGbSetting?.value === "string" ? actualGbSetting.value : null;

  const sortedPlayers = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      teamName: p.team?.name ?? null,
      teamFlag: p.team?.flag ?? null,
      photo: p.photo,
    }))
    .sort((a, b) => {
      // Players with photos first, then by position priority.
      if (Boolean(a.photo) !== Boolean(b.photo)) return a.photo ? -1 : 1;
      const rankA = POSITION_RANK[a.position ?? ""] ?? 9;
      const rankB = POSITION_RANK[b.position ?? ""] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      const teamCmp = (a.teamName ?? "").localeCompare(b.teamName ?? "");
      if (teamCmp !== 0) return teamCmp;
      return a.name.localeCompare(b.name);
    });

  const score = scoreAwards(
    {
      winnerTeamId: winnerPick?.teamId ?? null,
      goldenBootPlayerId: goldenBootPick?.playerId ?? null,
    },
    { actualWinnerTeamId, actualGoldenBootPlayerId },
    config
  );

  const winnerTeam = winnerPick
    ? teams.find((t) => t.id === winnerPick.teamId) ?? null
    : null;
  const goldenBootPlayer = goldenBootPick
    ? sortedPlayers.find((p) => p.id === goldenBootPick.playerId) ?? null
    : null;
  const actualWinnerTeam = actualWinnerTeamId
    ? teams.find((t) => t.id === actualWinnerTeamId) ?? null
    : null;
  const actualGoldenBootPlayer = actualGoldenBootPlayerId
    ? sortedPlayers.find((p) => p.id === actualGoldenBootPlayerId) ?? null
    : null;

  return (
    <PageContainer title="Awards">
      <Card className="px-4 sm:px-6 py-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              {locked
                ? "Tournament has started — picks are locked"
                : lockTime
                  ? `Picks lock at first kickoff: ${formatKickoff(lockTime)}`
                  : "No fixtures scheduled yet"}
            </p>
            <p className="heading text-lg">
              Headline picks for the tournament
            </p>
          </div>
          <div className="text-right">
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              Awards points
            </p>
            <p className="heading text-2xl">{score.total}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="px-4 py-4 gap-3">
          <div className="flex items-center justify-between">
            <span className="heading text-base flex items-center gap-2">
              <Trophy className="size-4" /> Tournament winner
            </span>
            <Chip
              size="small"
              color="brand"
              label={`${config.tournamentWinnerPoints} pts if right`}
            />
          </div>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Who lifts the trophy in MetLife Stadium?
          </p>
          <WinnerPickerForm
            teams={teams.map((t) => ({
              id: t.id,
              name: t.name,
              code: t.code,
              flag: t.flag,
            }))}
            initial={winnerPick ? { teamId: winnerPick.teamId } : null}
            locked={locked}
          />
          {actualWinnerTeam && (
            <div className="rounded-md border border-[color:var(--color-border-secondary)] px-3 py-2 flex items-center gap-2">
              {actualWinnerTeam.flag && (
                <img
                  src={actualWinnerTeam.flag}
                  alt=""
                  className="w-7 h-5 rounded-sm object-cover shrink-0"
                />
              )}
              <span className="body body-size-small text-[color:var(--color-text-secondary)]">
                Actual winner:
              </span>{" "}
              <span className="body-weight-medium">{actualWinnerTeam.name}</span>
              {winnerTeam && (
                <span
                  className={
                    "ml-auto body body-size-small " +
                    (winnerTeam.id === actualWinnerTeam.id
                      ? "text-[color:var(--color-accent-success)]"
                      : "text-[color:var(--color-text-tertiary)]")
                  }
                >
                  {score.winnerPoints} pt{score.winnerPoints === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </Card>

        <Card className="px-4 py-4 gap-3">
          <div className="flex items-center justify-between">
            <span className="heading text-base flex items-center gap-2">
              <Goal className="size-4" /> Golden Boot
            </span>
            <Chip
              size="small"
              color="amber"
              label={`${config.goldenBootPoints} pts if right`}
            />
          </div>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Who finishes the tournament as top scorer?
          </p>
          {sortedPlayers.length === 0 ? (
            <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
              No players synced yet. Ask an admin to sync squads from
              football-data.org.
            </p>
          ) : (
            <GoldenBootPickerForm
              players={sortedPlayers}
              initial={goldenBootPick ? { playerId: goldenBootPick.playerId } : null}
              locked={locked}
            />
          )}
          {actualGoldenBootPlayer && (
            <div className="rounded-md border border-[color:var(--color-border-secondary)] px-3 py-2 flex items-center gap-3">
              <PlayerAvatar
                name={actualGoldenBootPlayer.name}
                photo={actualGoldenBootPlayer.photo}
                teamFlag={actualGoldenBootPlayer.teamFlag}
                teamName={actualGoldenBootPlayer.teamName}
                size={36}
              />
              <div className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="body body-size-small text-[color:var(--color-text-secondary)]">
                  Actual top scorer:
                </span>
                <span className="body-weight-medium body-size-small truncate">
                  {actualGoldenBootPlayer.name}
                </span>
              </div>
              {goldenBootPlayer && (
                <span
                  className={
                    "body body-size-small shrink-0 " +
                    (goldenBootPlayer.id === actualGoldenBootPlayer.id
                      ? "text-[color:var(--color-accent-success)]"
                      : "text-[color:var(--color-text-tertiary)]")
                  }
                >
                  {score.goldenBootPoints} pt
                  {score.goldenBootPoints === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
