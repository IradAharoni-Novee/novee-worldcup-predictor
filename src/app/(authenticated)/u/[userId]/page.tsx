import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { formatKickoff, isMatchLive, stageLabel } from "@/lib/format";
import { getLeaderboard, getScoringConfig } from "@/lib/leaderboard";
import { scorePrediction } from "@/lib/scoring";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import { KNOCKOUT_STAGES, computeAdvancers } from "@/lib/scoring-bracket";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
  scoreAwards,
} from "@/lib/scoring-awards";
import {
  getBracketLockTime,
  getGroupLockTimes,
  getTournamentLockTime,
} from "@/lib/locks";
import {
  isAwardsRevealed,
  isBracketRevealed,
  revealedGroups,
  revealedMatchPredictions,
} from "@/lib/profile-visibility";

const ROUND_LABELS = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD: "Third place",
  FINAL: "Final",
} as const;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { userId } = await params;
  if (userId === session.user.id) redirect("/me");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) notFound();

  const now = new Date();
  const config = await getScoringConfig();

  const [
    leaderboard,
    predictions,
    groupPredictions,
    bracketPicks,
    groupMatches,
    knockoutMatches,
    winnerPick,
    goldenBootPick,
    actualWinnerSetting,
    actualGbSetting,
    groupLockTimes,
    bracketLockTime,
    tournamentLockTime,
  ] = await Promise.all([
    getLeaderboard(),
    prisma.prediction.findMany({
      where: { userId },
      orderBy: { match: { kickoff: "asc" } },
      include: {
        match: {
          include: {
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
    }),
    prisma.groupPrediction.findMany({
      where: { userId },
      include: {
        team1st: { select: { name: true, flag: true } },
        team2nd: { select: { name: true, flag: true } },
        team3rd: { select: { name: true, flag: true } },
        team4th: { select: { name: true, flag: true } },
      },
    }),
    prisma.bracketPick.findMany({
      where: { userId },
      include: { team: { select: { name: true, flag: true } } },
    }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: {
        group: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        status: true,
      },
    }),
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
      select: {
        stage: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
    }),
    prisma.tournamentWinnerPrediction.findUnique({
      where: { userId },
      include: { team: { select: { name: true, flag: true } } },
    }),
    prisma.goldenBootPrediction.findUnique({
      where: { userId },
      include: {
        player: {
          select: {
            name: true,
            photo: true,
            team: { select: { name: true, flag: true } },
          },
        },
      },
    }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_WINNER } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT } }),
    getGroupLockTimes(),
    getBracketLockTime(),
    getTournamentLockTime(),
  ]);

  const displayName = user.name ?? user.email.split("@")[0];
  const rankIndex = leaderboard.findIndex((r) => r.userId === userId);
  const row = rankIndex >= 0 ? leaderboard[rankIndex] : null;

  const actualWinnerTeamId =
    typeof actualWinnerSetting?.value === "string"
      ? actualWinnerSetting.value
      : null;
  const actualGoldenBootPlayerId =
    typeof actualGbSetting?.value === "string" ? actualGbSetting.value : null;

  const awardsRevealed = isAwardsRevealed(tournamentLockTime, now);
  const awardsScore = scoreAwards(
    {
      winnerTeamId: winnerPick?.teamId ?? null,
      goldenBootPlayerId: goldenBootPick?.playerId ?? null,
    },
    { actualWinnerTeamId, actualGoldenBootPlayerId },
    config
  );

  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (!m.group) continue;
    const list = matchesByGroup.get(m.group) ?? [];
    list.push(m);
    matchesByGroup.set(m.group, list);
  }

  const visibleGroups = revealedGroups(groupPredictions, groupLockTimes, now)
    .map((gp) => {
      const matches = matchesByGroup.get(gp.group) ?? [];
      const allFinished =
        matches.length > 0 && matches.every((m) => m.status === "FINISHED");
      const standings = allFinished ? computeGroupStandings(matches) : null;
      const score = standings ? scoreGroupPrediction(gp, standings, config) : null;
      return {
        group: gp.group,
        score,
        ranking: [
          { pos: 1, team: gp.team1st },
          { pos: 2, team: gp.team2nd },
          { pos: 3, team: gp.team3rd },
          { pos: 4, team: gp.team4th },
        ],
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group));

  const bracketRevealed = isBracketRevealed(bracketLockTime, now);
  const advancers = computeAdvancers(knockoutMatches);
  const bracketByRound = new Map<string, typeof bracketPicks>();
  for (const pick of bracketPicks) {
    const list = bracketByRound.get(pick.round) ?? [];
    list.push(pick);
    bracketByRound.set(pick.round, list);
  }

  const visibleMatches = revealedMatchPredictions(predictions, now);

  return (
    <PageContainer title={displayName}>
      <Card className="px-4 sm:px-6 gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            email={user.email}
            name={user.name}
            image={user.image}
            size={48}
          />
          <div className="flex flex-col min-w-0">
            <span className="heading text-xl truncate">{displayName}</span>
            <span className="body body-size-small text-[color:var(--color-text-tertiary)] truncate">
              {user.email}
            </span>
          </div>
          {rankIndex >= 0 && (
            <Chip
              size="small"
              color="slate"
              label={`Rank #${rankIndex + 1}`}
              className="ml-auto"
            />
          )}
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <Stat label="Total points" value={row?.total ?? 0} />
          <Stat label="Match points" value={row?.matchPoints ?? 0} />
          <Stat label="Group points" value={row?.groupPoints ?? 0} />
          <Stat label="Bracket points" value={row?.bracketPoints ?? 0} />
          <Stat label="Awards points" value={row?.awardsPoints ?? 0} />
        </div>
      </Card>

      <Section title="Tournament awards">
        {!awardsRevealed ? (
          <EmptyHint>Hidden until the tournament kicks off.</EmptyHint>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            <Card className="py-3 px-4 gap-2">
              <div className="flex items-center justify-between">
                <span className="body body-weight-medium body-size-small">
                  Tournament winner
                </span>
                {actualWinnerTeamId && (
                  <Chip
                    size="small"
                    color={awardsScore.winnerPoints > 0 ? "green" : "slate"}
                    label={`${awardsScore.winnerPoints} pt${
                      awardsScore.winnerPoints === 1 ? "" : "s"
                    }`}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {winnerPick?.team.flag && (
                  <img
                    src={winnerPick.team.flag}
                    alt=""
                    className="w-8 h-6 rounded-sm object-cover"
                  />
                )}
                <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                  {winnerPick ? winnerPick.team.name : "No pick"}
                </span>
              </div>
            </Card>
            <Card className="py-3 px-4 gap-2">
              <div className="flex items-center justify-between">
                <span className="body body-weight-medium body-size-small">
                  Golden boot
                </span>
                {actualGoldenBootPlayerId && (
                  <Chip
                    size="small"
                    color={awardsScore.goldenBootPoints > 0 ? "green" : "slate"}
                    label={`${awardsScore.goldenBootPoints} pt${
                      awardsScore.goldenBootPoints === 1 ? "" : "s"
                    }`}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {goldenBootPick && (
                  <PlayerAvatar
                    name={goldenBootPick.player.name}
                    photo={goldenBootPick.player.photo}
                    teamFlag={goldenBootPick.player.team?.flag ?? null}
                    teamName={goldenBootPick.player.team?.name ?? null}
                    size={32}
                  />
                )}
                <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                  {goldenBootPick
                    ? `${goldenBootPick.player.name}${
                        goldenBootPick.player.team?.name
                          ? ` (${goldenBootPick.player.team.name})`
                          : ""
                      }`
                    : "No pick"}
                </span>
              </div>
            </Card>
          </div>
        )}
      </Section>

      <Section title="Group predictions">
        {visibleGroups.length === 0 ? (
          <EmptyHint>No group picks revealed yet.</EmptyHint>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {visibleGroups.map((g) => (
              <Card key={g.group} className="py-3 gap-2">
                <div className="px-4 flex items-center justify-between">
                  <span className="heading text-base">Group {g.group}</span>
                  {g.score ? (
                    <Chip
                      size="small"
                      color={g.score.total > 0 ? "green" : "slate"}
                      label={`${g.score.total} pt${
                        g.score.total === 1 ? "" : "s"
                      }`}
                    />
                  ) : (
                    <Chip size="small" color="amber" label="Pending" />
                  )}
                </div>
                <ol className="px-4 flex flex-col gap-1">
                  {g.ranking.map((r) => (
                    <li
                      key={r.pos}
                      className="flex items-center gap-2 body body-size-small"
                    >
                      <span className="tabular-nums text-[color:var(--color-text-tertiary)] w-4">
                        {r.pos}
                      </span>
                      {r.team.flag && (
                        <img
                          src={r.team.flag}
                          alt=""
                          className="w-5 h-3.5 rounded-sm object-cover"
                        />
                      )}
                      <span className="truncate">{r.team.name}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Bracket">
        {!bracketRevealed || bracketPicks.length === 0 ? (
          <EmptyHint>No bracket revealed yet.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            {KNOCKOUT_STAGES.map((round) => {
              const picks = (bracketByRound.get(round) ?? [])
                .slice()
                .sort((a, b) => a.slot - b.slot);
              if (picks.length === 0) return null;
              return (
                <Card key={round} className="py-3 gap-2 px-4">
                  <span className="body body-weight-medium body-size-small">
                    {ROUND_LABELS[round]}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {picks.map((pick) => (
                      <Chip
                        key={pick.id}
                        size="small"
                        color={
                          advancers[round].has(pick.teamId) ? "green" : "slate"
                        }
                        label={pick.team.name}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Match predictions">
        {visibleMatches.length === 0 ? (
          <EmptyHint>No match picks revealed yet.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleMatches.map((p) => {
              const points = scorePrediction(
                { homeScore: p.homeScore, awayScore: p.awayScore },
                {
                  stage: p.match.stage,
                  homeScore: p.match.homeScore,
                  awayScore: p.match.awayScore,
                },
                config
              );
              return (
                <Link
                  key={p.id}
                  href={`/matches/${p.match.id}`}
                  className="block"
                >
                  <Card className="py-3 gap-2 hover:border-[color:var(--color-border-hover)] transition-colors">
                    <div className="px-4 flex items-center justify-between">
                      <Chip
                        size="small"
                        color="slate"
                        label={stageLabel(p.match.stage, p.match.group)}
                      />
                      <span className="body body-size-small text-[color:var(--color-text-secondary)]">
                        {formatKickoff(p.match.kickoff)}
                      </span>
                    </div>
                    <div className="px-4 flex items-center justify-between gap-3">
                      <span className="body body-size-medium truncate">
                        {p.match.homeTeam?.name ?? "TBD"} vs{" "}
                        {p.match.awayTeam?.name ?? "TBD"}
                      </span>
                      <span className="code code-size-medium tabular-nums">
                        {p.homeScore}–{p.awayScore}
                      </span>
                    </div>
                    {p.note && (
                      <div className="px-4 italic body body-size-small text-[color:var(--color-text-tertiary)]">
                        {displayName} said: &ldquo;{p.note}&rdquo;
                      </div>
                    )}
                    <div className="px-4 flex items-center justify-between body body-size-small">
                      <span className="text-[color:var(--color-text-tertiary)]">
                        {p.match.status === "FINISHED"
                          ? `Actual: ${p.match.homeScore}–${p.match.awayScore}`
                          : isMatchLive(p.match.status, p.match.kickoff)
                            ? "Live"
                            : "Upcoming"}
                      </span>
                      {p.match.status === "FINISHED" && (
                        <span
                          className={
                            points > 0
                              ? "text-[color:var(--color-accent-success)] body-weight-medium"
                              : "text-[color:var(--color-text-tertiary)]"
                          }
                        >
                          {points} pt{points === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="body body-size-small text-[color:var(--color-text-secondary)]">
        {label}
      </p>
      <p className="heading text-3xl">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="subheading subheading-size-large subheading-weight-medium mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-8 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
      {children}
    </div>
  );
}
