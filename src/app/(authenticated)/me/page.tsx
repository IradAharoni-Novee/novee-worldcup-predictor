import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { formatKickoff, stageLabel } from "@/lib/format";
import { getScoringConfig } from "@/lib/leaderboard";
import { scorePrediction } from "@/lib/scoring";
import { computeGroupStandings } from "@/lib/group-standings";
import { scoreGroupPrediction } from "@/lib/scoring-groups";
import {
  KNOCKOUT_STAGES,
  computeAdvancers,
  scoreBracketPicks,
} from "@/lib/scoring-bracket";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
  scoreAwards,
} from "@/lib/scoring-awards";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { veeveeLine } from "@/lib/veevee-voice";
import { computeAchievementsForUser } from "@/lib/achievements";
import { AchievementsRow } from "@/components/me/achievements-row";
import { NemesisCard } from "@/components/me/nemesis-card";
import { CelebrationTrigger } from "@/components/me/celebration-trigger";
import { ProfileEditor } from "@/components/me/profile-editor";
import { getLeaderboard } from "@/lib/leaderboard";
import { isAiPlayer } from "@/lib/ai-players";

const ROUND_LABELS = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD: "Third place",
  FINAL: "Final",
} as const;

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const [
    predictions,
    groupPredictions,
    bracketPicks,
    groupMatches,
    knockoutMatches,
    winnerPick,
    goldenBootPick,
    actualWinnerSetting,
    actualGbSetting,
  ] = await Promise.all([
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
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.bracketPick.findMany({ where: { userId } }),
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
  ]);

  const actualWinnerTeamId =
    typeof actualWinnerSetting?.value === "string" ? actualWinnerSetting.value : null;
  const actualGoldenBootPlayerId =
    typeof actualGbSetting?.value === "string" ? actualGbSetting.value : null;
  const awardsScore = scoreAwards(
    {
      winnerTeamId: winnerPick?.teamId ?? null,
      goldenBootPlayerId: goldenBootPick?.playerId ?? null,
    },
    { actualWinnerTeamId, actualGoldenBootPlayerId },
    config
  );

  const matchPoints = predictions.reduce((sum, p) => {
    return (
      sum +
      scorePrediction(
        { homeScore: p.homeScore, awayScore: p.awayScore },
        {
          stage: p.match.stage,
          homeScore: p.match.homeScore,
          awayScore: p.match.awayScore,
        },
        config
      )
    );
  }, 0);

  const matchesByGroup = new Map<string, typeof groupMatches>();
  for (const m of groupMatches) {
    if (!m.group) continue;
    const list = matchesByGroup.get(m.group) ?? [];
    list.push(m);
    matchesByGroup.set(m.group, list);
  }

  const groupBreakdown = groupPredictions
    .map((gp) => {
      const matches = matchesByGroup.get(gp.group) ?? [];
      const allFinished = matches.length > 0 && matches.every((m) => m.status === "FINISHED");
      const standings = allFinished ? computeGroupStandings(matches) : null;
      const score = standings ? scoreGroupPrediction(gp, standings, config) : null;
      return { group: gp.group, score, locked: matches.length > 0 };
    })
    .sort((a, b) => a.group.localeCompare(b.group));

  const groupPoints = groupBreakdown.reduce((sum, g) => sum + (g.score?.total ?? 0), 0);

  const advancers = computeAdvancers(knockoutMatches);
  const bracketScore = scoreBracketPicks(
    bracketPicks.map((p) => ({ round: p.round, slot: p.slot, teamId: p.teamId })),
    advancers,
    config
  );

  const total = matchPoints + groupPoints + bracketScore.total + awardsScore.total;

  const [achievements, leaderboard, me] = await Promise.all([
    computeAchievementsForUser(userId),
    getLeaderboard(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { nemesisId: true, email: true, name: true, image: true },
    }),
  ]);

  const currentUserRow = leaderboard.find((r) => r.userId === userId);
  const nemesisRow = me?.nemesisId
    ? leaderboard.find((r) => r.userId === me.nemesisId) ?? null
    : null;
  const nemesisCandidates = leaderboard.filter(
    (r) => r.userId !== userId && !isAiPlayer(r.email)
  );

  const aiRows = leaderboard.filter((r) => isAiPlayer(r.email));

  const myRankIndex = leaderboard.findIndex((r) => r.userId === userId);
  const inTop3 = myRankIndex >= 0 && myRankIndex < 3;
  const hasFirstExact = (currentUserRow?.exact ?? 0) >= 1;

  return (
    <PageContainer title="My predictions">
      <CelebrationTrigger
        userId={userId}
        hasFirstExact={hasFirstExact}
        inTop3={inTop3}
      />
      {me && (
        <Section title="Profile">
          <ProfileEditor
            email={me.email}
            name={me.name}
            image={me.image}
            uploadsEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
          />
        </Section>
      )}
      <Card className="px-4 sm:px-6">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <Stat label="Total points" value={total} />
          <Stat label="Match points" value={matchPoints} />
          <Stat label="Group points" value={groupPoints} />
          <Stat label="Bracket points" value={bracketScore.total} />
          <Stat label="Awards points" value={awardsScore.total} />
        </div>
      </Card>

      <Section title="Achievements">
        <AchievementsRow achievements={achievements} />
      </Section>

      {currentUserRow && (
        <Section title="Rivals">
          <div className="grid gap-3 md:grid-cols-2">
            <NemesisCard
              currentUserRow={currentUserRow}
              nemesisRow={nemesisRow}
              candidates={nemesisCandidates}
            />
            {aiRows.length > 0 && (
              <AiScoreboard yourTotal={currentUserRow.total} aiRows={aiRows} />
            )}
          </div>
        </Section>
      )}

      <Section title="Tournament awards">
        <div className="grid gap-2 md:grid-cols-2">
          <Card className="py-3 px-4 gap-2">
            <div className="flex items-center justify-between">
              <span className="body body-weight-medium body-size-small">
                Tournament winner
              </span>
              {actualWinnerTeamId ? (
                <Chip
                  size="small"
                  color={awardsScore.winnerPoints > 0 ? "green" : "slate"}
                  label={`${awardsScore.winnerPoints} pt${
                    awardsScore.winnerPoints === 1 ? "" : "s"
                  }`}
                />
              ) : (
                <Chip size="small" color="amber" label={winnerPick ? "Picked" : "No pick"} />
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
                {winnerPick ? winnerPick.team.name : "No pick yet"}
              </span>
            </div>
          </Card>
          <Card className="py-3 px-4 gap-2">
            <div className="flex items-center justify-between">
              <span className="body body-weight-medium body-size-small">
                Golden boot
              </span>
              {actualGoldenBootPlayerId ? (
                <Chip
                  size="small"
                  color={awardsScore.goldenBootPoints > 0 ? "green" : "slate"}
                  label={`${awardsScore.goldenBootPoints} pt${
                    awardsScore.goldenBootPoints === 1 ? "" : "s"
                  }`}
                />
              ) : (
                <Chip size="small" color="amber" label={goldenBootPick ? "Picked" : "No pick"} />
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
                  : "No pick yet"}
              </span>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Group predictions">
        {groupBreakdown.length === 0 ? (
          <EmptyHint voice={veeveeLine("emptyGroups", userId)}>
            You haven&apos;t predicted any groups yet.{" "}
            <Link
              href="/groups"
              className="text-[color:var(--color-action-primary-cta)] underline"
            >
              Go rank some teams
            </Link>
            .
          </EmptyHint>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {groupBreakdown.map((g) => (
              <Link key={g.group} href={`/groups/${g.group}`} className="block">
                <Card className="py-3 gap-1 hover:border-[color:var(--color-border-hover)] transition-colors">
                  <div className="px-4 flex items-center justify-between">
                    <span className="heading text-base">Group {g.group}</span>
                    {g.score ? (
                      <Chip
                        size="small"
                        color={g.score.total > 0 ? "green" : "slate"}
                        label={`${g.score.total} pt${g.score.total === 1 ? "" : "s"}`}
                      />
                    ) : (
                      <Chip size="small" color="amber" label="Pending" />
                    )}
                  </div>
                  {g.score && (
                    <div className="px-4 body body-size-small text-[color:var(--color-text-tertiary)]">
                      {g.score.exact} exact · {g.score.halfRight} half-right
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Bracket">
        {bracketPicks.length === 0 ? (
          <EmptyHint voice={veeveeLine("emptyBracket", userId)}>
            You haven&apos;t submitted a bracket yet.{" "}
            <Link
              href="/bracket"
              className="text-[color:var(--color-action-primary-cta)] underline"
            >
              Fill out the bracket
            </Link>
            .
          </EmptyHint>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            {KNOCKOUT_STAGES.map((round) => (
              <Card key={round} className="py-3 gap-1">
                <div className="px-4 flex items-center justify-between">
                  <span className="body body-weight-medium body-size-small">
                    {ROUND_LABELS[round]}
                  </span>
                  <Chip
                    size="small"
                    color={bracketScore.perRound[round] > 0 ? "green" : "slate"}
                    label={`${bracketScore.perRound[round]} pt${
                      bracketScore.perRound[round] === 1 ? "" : "s"
                    }`}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Match predictions">
        {predictions.length === 0 ? (
          <EmptyHint voice={veeveeLine("emptyMe", userId)}>
            You haven&apos;t submitted any match predictions yet.{" "}
            <Link
              href="/matches"
              className="text-[color:var(--color-action-primary-cta)] underline"
            >
              Go pick some matches
            </Link>
            .
          </EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            {predictions.map((p) => {
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
                        You said: &ldquo;{p.note}&rdquo;
                      </div>
                    )}
                    <div className="px-4 flex items-center justify-between body body-size-small">
                      <span className="text-[color:var(--color-text-tertiary)]">
                        {p.match.status === "FINISHED"
                          ? `Actual: ${p.match.homeScore}–${p.match.awayScore}`
                          : p.match.status === "LIVE"
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

function AiScoreboard({
  yourTotal,
  aiRows,
}: {
  yourTotal: number;
  aiRows: { name: string | null; email: string; total: number }[];
}) {
  return (
    <Card className="px-4 py-4 gap-3">
      <div>
        <p className="heading text-base">Vs the bots</p>
        <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
          VeeVee&apos;s seeded players. Beat them, mock them. Or both.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {aiRows.map((ai) => {
          const delta = yourTotal - ai.total;
          const ahead = delta > 0;
          const tied = delta === 0;
          return (
            <li
              key={ai.email}
              className="flex items-center justify-between gap-3"
            >
              <span className="body body-size-medium">
                {ai.name ?? ai.email.split("@")[0]}
              </span>
              <span
                className={
                  "code code-size-medium tabular-nums " +
                  (ahead
                    ? "text-[color:var(--color-accent-success)]"
                    : tied
                      ? "text-[color:var(--color-text-tertiary)]"
                      : "text-[color:var(--color-accent-danger)]")
                }
              >
                {ahead ? "+" : ""}
                {delta}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="subheading subheading-size-large subheading-weight-medium mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyHint({
  voice,
  children,
}: {
  voice?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-8 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
      {voice && (
        <p className="italic text-[color:var(--color-text-tertiary)] mb-2">
          {voice}
        </p>
      )}
      {children}
    </div>
  );
}
