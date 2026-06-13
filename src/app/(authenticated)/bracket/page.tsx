import { redirect } from "next/navigation";
import { Stage } from "@prisma/client";
import { MapPin } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { stageLabel } from "@/lib/format";
import {
  BracketPredictorForm,
  type Team,
} from "@/components/predictor/bracket-predictor-form";
import { LocalKickoff, SubmissionDeadline } from "@/components/predictor/submission-deadline";
import {
  resolveR32Slots,
  type GroupPickLookup,
} from "@/lib/bracket-seeding";
import { getBracketLockTime, isBracketLocked } from "@/lib/locks";
import { getScoringConfig } from "@/lib/leaderboard";
import {
  KNOCKOUT_STAGES,
  computeAdvancers,
  scoreBracketPicks,
  type KnockoutMatch,
} from "@/lib/scoring-bracket";
import type { KnockoutStage, ScoringConfig } from "@/lib/scoring";

const ROUND_LABELS = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD: "Third place",
  FINAL: "Final",
} as const;

export default async function BracketPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const config = await getScoringConfig();

  const [
    teams,
    groupPredictions,
    thirdPlacePicks,
    bracketPicks,
    knockoutMatches,
    locked,
    lockTime,
  ] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true, flag: true } }),
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.thirdPlaceQualifierPick.findMany({
      where: { userId },
      select: { teamId: true },
    }),
    prisma.bracketPick.findMany({ where: { userId } }),
    prisma.match.findMany({
      where: { stage: { in: ["R32", "R16", "QF", "SF", "THIRD", "FINAL"] } },
      orderBy: { kickoff: "asc" },
      select: {
        id: true,
        stage: true,
        kickoff: true,
        venue: true,
        city: true,
        country: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true, code: true, flag: true } },
        awayTeam: { select: { name: true, code: true, flag: true } },
      },
    }),
    isBracketLocked(),
    getBracketLockTime(),
  ]);

  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t])) as Record<
    string,
    Team
  >;

  const groupPickMap = new Map<string, GroupPickLookup>();
  // teamId → group: every team the user predicted as 3rd-place in some group
  // is a potential third-place qualifier; map each one back to its group so
  // bracket seeding can route picks into the right R32 slots.
  const thirdPlaceTeamToGroup = new Map<string, string>();
  for (const gp of groupPredictions) {
    groupPickMap.set(gp.group, {
      group: gp.group,
      team1stId: gp.team1stId,
      team2ndId: gp.team2ndId,
      team3rdId: gp.team3rdId,
      team4thId: gp.team4thId,
    });
    thirdPlaceTeamToGroup.set(gp.team3rdId, gp.group);
  }
  // Restrict to the user's saved qualifier picks. Drop any whose underlying
  // 3rd-place pick has since changed.
  const qualifierGroupByTeamId = new Map<string, string>();
  for (const p of thirdPlacePicks) {
    const group = thirdPlaceTeamToGroup.get(p.teamId);
    if (group) qualifierGroupByTeamId.set(p.teamId, group);
  }

  const r32Seeded = resolveR32Slots(groupPickMap, qualifierGroupByTeamId);

  if (locked) {
    return (
      <PageContainer title="Bracket">
        <WideBleed>
          <LockedBracket
            teamsById={teamsById}
            bracketPicks={bracketPicks}
            knockoutMatches={knockoutMatches}
            config={config}
          />
        </WideBleed>
      </PageContainer>
    );
  }

  const allGroupsPredicted = groupPredictions.length > 0;

  return (
    <PageContainer title="Bracket">
      {!allGroupsPredicted && (
        <Card className="px-4 py-3 mb-4 border-[color:var(--color-accent-warning,var(--color-border-primary))]">
          <p className="body body-size-medium">
            Predict your group standings first to auto-seed the Round of 32.
            You can still pick teams manually for unfilled slots.
          </p>
        </Card>
      )}
      <div className="mb-3 flex flex-col gap-1">
        <p className="body body-size-medium text-[color:var(--color-text-secondary)]">
          Click a team to mark them as winner of that match. Winners advance to
          the next round.
        </p>
        {lockTime && <SubmissionDeadline deadline={lockTime} />}
      </div>
      <WideBleed>
        <BracketPredictorForm
          teamsById={teamsById}
          r32Seeding={r32Seeded}
          initialPicks={bracketPicks.map((p) => ({
            round: p.round,
            slot: p.slot,
            teamId: p.teamId,
          }))}
        />
      </WideBleed>
    </PageContainer>
  );
}

// Lets the bracket break out of the global 72rem max-width on wide screens.
// The layout caps content at 72rem (max-w-6xl). On a wider monitor we pull
// the wrapper outward with a negative margin equal to half the gap between
// viewport and 72rem; `min(0px, ...)` clamps to zero on screens at or below
// the cap so the bracket never gets pushed inward on smaller devices.
function WideBleed({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 sm:px-6"
      style={{ marginInline: "min(0px, calc((72rem - 100vw) / 2))" }}
    >
      {children}
    </div>
  );
}

type ScheduleMatch = KnockoutMatch & {
  id: string;
  kickoff: Date;
  venue: string | null;
  city: string | null;
  country: string | null;
  homeTeam: { name: string; code: string; flag: string | null } | null;
  awayTeam: { name: string; code: string; flag: string | null } | null;
};

function LockedBracket({
  teamsById,
  bracketPicks,
  knockoutMatches,
  config,
}: {
  teamsById: Record<string, Team>;
  bracketPicks: { round: Stage; slot: number; teamId: string }[];
  knockoutMatches: ScheduleMatch[];
  config: ScoringConfig;
}) {
  const advancers = computeAdvancers(knockoutMatches);
  const score = scoreBracketPicks(bracketPicks, advancers, config);

  return (
    <>
      <Card className="px-4 sm:px-6 py-4 mb-4 gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              Status
            </p>
            <p className="heading text-lg">Locked — knockouts have started</p>
          </div>
          <div className="text-right shrink-0">
            <p className="body body-size-small text-[color:var(--color-text-secondary)]">
              Bracket points
            </p>
            <p className="heading text-2xl">{score.total}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KNOCKOUT_STAGES.map((round: KnockoutStage) => {
          const picksForRound = bracketPicks.filter((p) => p.round === round);
          return (
            <Card key={round} className="px-4 py-3 gap-2">
              <div className="flex items-center justify-between">
                <span className="subheading subheading-size-medium subheading-weight-medium">
                  {ROUND_LABELS[round]}
                </span>
                <Chip
                  size="small"
                  color={score.perRound[round] > 0 ? "green" : "slate"}
                  label={`${score.perRound[round]} pt${
                    score.perRound[round] === 1 ? "" : "s"
                  }`}
                />
              </div>
              <ul className="flex flex-col gap-1">
                {picksForRound
                  .sort((a, b) => a.slot - b.slot)
                  .map((p) => {
                    const team = teamsById[p.teamId];
                    const correct = advancers[round].has(p.teamId);
                    return (
                      <li
                        key={`${p.round}-${p.slot}`}
                        className={
                          "body body-size-small flex items-center justify-between " +
                          (correct
                            ? "text-[color:var(--color-accent-success)]"
                            : "text-[color:var(--color-text-tertiary)]")
                        }
                      >
                        <span className="truncate">{team?.name ?? "—"}</span>
                        <span className="code code-size-small tabular-nums">
                          #{p.slot + 1}
                        </span>
                      </li>
                    );
                  })}
                {picksForRound.length === 0 && (
                  <li className="body body-size-small text-[color:var(--color-text-tertiary)]">
                    No picks submitted.
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>

      <KnockoutSchedule matches={knockoutMatches} />
    </>
  );
}

function KnockoutSchedule({ matches }: { matches: ScheduleMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="subheading subheading-size-large subheading-weight-medium mb-3">
        Knockout schedule
      </h2>
      <Card className="px-0 py-0 overflow-hidden">
        <ul className="divide-y divide-[color:var(--color-border-secondary)]">
          {matches.map((m) => {
            const home = m.homeTeam?.name ?? "TBD";
            const away = m.awayTeam?.name ?? "TBD";
            const locationParts = [m.city, m.country].filter(Boolean);
            return (
              <li
                key={m.id}
                className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Chip size="small" color="slate" label={stageLabel(m.stage, null)} />
                  <span className="body body-size-medium truncate">
                    {home} <span className="text-[color:var(--color-text-tertiary)]">vs</span> {away}
                  </span>
                </div>
                <div className="flex items-center gap-3 body body-size-small text-[color:var(--color-text-secondary)]">
                  <LocalKickoff
                    date={m.kickoff}
                    className="text-[color:var(--color-text-tertiary)] shrink-0"
                  />
                  {m.venue && (
                    <span className="flex items-start gap-1 min-w-0">
                      <MapPin className="size-3.5 mt-0.5 shrink-0 text-[color:var(--color-text-tertiary)]" />
                      <span className="truncate">
                        <span>{m.venue}</span>
                        {locationParts.length > 0 && (
                          <span className="text-[color:var(--color-text-tertiary)]">
                            {" · "}
                            {locationParts.join(", ")}
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
