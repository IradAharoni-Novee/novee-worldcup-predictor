# Public User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/u/[userId]` page where any signed-in user can view another player's locked predictions (a public, lock-filtered mirror of `/me`), reachable from the leaderboard and from de-anonymized match "hot takes".

**Architecture:** A server component at `src/app/(authenticated)/u/[userId]/page.tsx` loads the target user's predictions and reuses the existing scoring/standings/lock helpers. A new pure module `src/lib/profile-visibility.ts` decides what is revealed (lock has passed) and is unit-tested. The leaderboard player cell and the match-detail hot-takes list link to the new page.

**Tech Stack:** Next.js 16 App Router (RSC), Prisma 6 / Postgres, Auth.js v5, Tailwind v4, Vitest.

---

## File structure

- **Create** `src/lib/profile-visibility.ts` — pure reveal predicates (lock-passed checks + list filters).
- **Create** `tests/profile-visibility.test.ts` — unit tests for the above.
- **Create** `src/app/(authenticated)/u/[userId]/page.tsx` — the profile server component.
- **Modify** `src/auth.config.ts` — add `/u` to `PROTECTED_PREFIXES`.
- **Modify** `src/app/(authenticated)/leaderboard/page.tsx` — link the player cell to the profile.
- **Modify** `src/app/(authenticated)/matches/[id]/page.tsx` — attribute + link hot-take authors.

---

## Task 1: Pure visibility module (TDD)

**Files:**
- Create: `src/lib/profile-visibility.ts`
- Test: `tests/profile-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/profile-visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isAwardsRevealed,
  isBracketRevealed,
  revealedGroups,
  revealedMatchPredictions,
} from "@/lib/profile-visibility";

const T = (iso: string) => new Date(iso);

describe("revealedMatchPredictions", () => {
  const now = T("2026-06-12T12:00:00Z");

  it("keeps predictions whose match kicked off at or before now", () => {
    const preds = [
      { id: "a", match: { kickoff: T("2026-06-12T11:00:00Z") } },
      { id: "b", match: { kickoff: T("2026-06-12T12:00:00Z") } },
      { id: "c", match: { kickoff: T("2026-06-12T13:00:00Z") } },
    ];
    expect(revealedMatchPredictions(preds, now).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns empty for empty input", () => {
    expect(revealedMatchPredictions([], now)).toEqual([]);
  });
});

describe("isAwardsRevealed / isBracketRevealed", () => {
  const now = T("2026-06-12T12:00:00Z");

  it("is false when the lock time is null (nothing seeded)", () => {
    expect(isAwardsRevealed(null, now)).toBe(false);
    expect(isBracketRevealed(null, now)).toBe(false);
  });

  it("is true once the lock time has passed", () => {
    expect(isAwardsRevealed(T("2026-06-12T11:59:59Z"), now)).toBe(true);
    expect(isBracketRevealed(T("2026-06-12T11:59:59Z"), now)).toBe(true);
  });

  it("is true at exactly the lock time", () => {
    expect(isAwardsRevealed(now, now)).toBe(true);
    expect(isBracketRevealed(now, now)).toBe(true);
  });

  it("is false before the lock time", () => {
    expect(isAwardsRevealed(T("2026-06-12T12:00:01Z"), now)).toBe(false);
    expect(isBracketRevealed(T("2026-06-12T12:00:01Z"), now)).toBe(false);
  });
});

describe("revealedGroups", () => {
  const now = T("2026-06-12T12:00:00Z");
  const locks = new Map<string, Date>([
    ["A", T("2026-06-12T11:00:00Z")],
    ["B", T("2026-06-12T13:00:00Z")],
  ]);

  it("keeps only groups whose first kickoff has passed", () => {
    const gps = [{ group: "A" }, { group: "B" }];
    expect(revealedGroups(gps, locks, now).map((g) => g.group)).toEqual(["A"]);
  });

  it("hides groups with no known lock time", () => {
    expect(revealedGroups([{ group: "C" }], locks, now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/profile-visibility.test.ts`
Expected: FAIL — cannot resolve `@/lib/profile-visibility`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/profile-visibility.ts`:

```ts
import { isLocked } from "@/lib/format";

/**
 * Reveal predicates for the public user profile. A prediction is visible to
 * other users only once its lock has passed, so nothing copyable leaks. All
 * predicates delegate to `isLocked` (a kickoff is locked once `kickoff <= now`).
 */

export function revealedMatchPredictions<T extends { match: { kickoff: Date } }>(
  predictions: T[],
  now: Date = new Date()
): T[] {
  return predictions.filter((p) => isLocked(p.match.kickoff, now));
}

export function revealedGroups<T extends { group: string }>(
  groupPredictions: T[],
  groupLockTimes: Map<string, Date>,
  now: Date = new Date()
): T[] {
  return groupPredictions.filter((gp) => {
    const lock = groupLockTimes.get(gp.group);
    return lock ? isLocked(lock, now) : false;
  });
}

export function isAwardsRevealed(
  tournamentLockTime: Date | null,
  now: Date = new Date()
): boolean {
  return tournamentLockTime ? isLocked(tournamentLockTime, now) : false;
}

export function isBracketRevealed(
  bracketLockTime: Date | null,
  now: Date = new Date()
): boolean {
  return bracketLockTime ? isLocked(bracketLockTime, now) : false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/profile-visibility.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-visibility.ts tests/profile-visibility.test.ts
git commit -m "feat: add lock-based reveal predicates for user profiles"
```

---

## Task 2: Gate `/u` behind auth

**Files:**
- Modify: `src/auth.config.ts:3-11`

- [ ] **Step 1: Add the prefix**

In `src/auth.config.ts`, add `"/u"` to the `PROTECTED_PREFIXES` array:

```ts
const PROTECTED_PREFIXES = [
  "/matches",
  "/bracket",
  "/leaderboard",
  "/me",
  "/admin",
  "/ctf",
  "/u",
];
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth.config.ts
git commit -m "feat: gate /u profile routes behind auth"
```

---

## Task 3: Profile page `/u/[userId]`

**Files:**
- Create: `src/app/(authenticated)/u/[userId]/page.tsx`

- [ ] **Step 1: Write the full page component**

Create `src/app/(authenticated)/u/[userId]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify type-check and lint pass**

Run: `pnpm type-check && pnpm lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/u/[userId]/page.tsx"
git commit -m "feat: add public user profile page with locked predictions"
```

---

## Task 4: Link leaderboard rows to profiles

**Files:**
- Modify: `src/app/(authenticated)/leaderboard/page.tsx`

- [ ] **Step 1: Add the Link import**

At the top of `src/app/(authenticated)/leaderboard/page.tsx`, add below the existing `lucide-react` import:

```ts
import Link from "next/link";
```

- [ ] **Step 2: Wrap the player cell in a Link**

Replace the player `<TableCell>` block (the cell containing `LeaderboardAvatar` and the name/email `<div>`) with:

```tsx
                  <TableCell>
                    <Link
                      href={me ? "/me" : `/u/${row.userId}`}
                      className="flex items-center gap-3 min-w-0 hover:underline"
                    >
                      <LeaderboardAvatar
                        email={row.email}
                        name={row.name}
                        image={row.image}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="body body-weight-medium body-size-medium truncate">
                          {row.name ?? row.email.split("@")[0]}
                          {me && (
                            <span className="ml-2 text-xs text-[color:var(--color-action-primary-cta)]">
                              You
                            </span>
                          )}
                        </span>
                        <span className="hidden sm:inline body body-size-small text-[color:var(--color-text-tertiary)] truncate">
                          {row.email}
                        </span>
                      </div>
                    </Link>
                  </TableCell>
```

- [ ] **Step 3: Verify type-check and lint pass**

Run: `pnpm type-check && pnpm lint`
Expected: no errors, no warnings.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/leaderboard/page.tsx"
git commit -m "feat: link leaderboard players to their profile page"
```

---

## Task 5: De-anonymize match-detail hot takes

**Files:**
- Modify: `src/app/(authenticated)/matches/[id]/page.tsx`

- [ ] **Step 1: Add the UserAvatar import**

Below the existing `PageContainer` import in `src/app/(authenticated)/matches/[id]/page.tsx`, add:

```ts
import { UserAvatar } from "@/components/ui/user-avatar";
```

- [ ] **Step 2: Select the author in the hot-takes query**

In the `hotTakes` Prisma query, replace its `select` block with one that also pulls the author:

```ts
            select: {
              id: true,
              note: true,
              homeScore: true,
              awayScore: true,
              user: {
                select: { id: true, name: true, image: true, email: true },
              },
            },
```

- [ ] **Step 3: Render the linked author in each hot take**

Replace the hot-takes `<li>` body (currently the italic note `<span>` plus the score `<span>`) with:

```tsx
              <li
                key={t.id}
                className="rounded-md border border-[color:var(--color-border-secondary)] px-4 py-2 body body-size-small flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/u/${t.user.id}`}
                    className="flex items-center gap-2 min-w-0 hover:underline shrink-0"
                  >
                    <UserAvatar
                      email={t.user.email}
                      name={t.user.name}
                      image={t.user.image}
                      size={24}
                    />
                    <span className="body-weight-medium truncate">
                      {t.user.name ?? t.user.email.split("@")[0]}
                    </span>
                  </Link>
                  <span className="italic truncate">&ldquo;{t.note}&rdquo;</span>
                </div>
                <span className="code code-size-small tabular-nums text-[color:var(--color-text-tertiary)] shrink-0">
                  {t.homeScore}–{t.awayScore}
                </span>
              </li>
```

- [ ] **Step 4: Verify type-check, lint, and existing tests pass**

Run: `pnpm type-check && pnpm lint && pnpm test`
Expected: no errors, no warnings, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/matches/[id]/page.tsx"
git commit -m "feat: attribute and link hot-take authors to their profile"
```

---

## Verification (after all tasks)

- [ ] `pnpm type-check` — clean.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm test` — all pass (includes new `profile-visibility` tests).
- [ ] `pnpm dev`, then manually:
  - Visit `/leaderboard`, click another player → lands on `/u/<id>` showing only revealed sections.
  - Click your own row → redirected to `/me`.
  - Visit `/u/<your-own-id>` directly → redirected to `/me`.
  - Visit `/u/does-not-exist` → 404.
  - Open a kicked-off match with notes → hot takes show clickable author names linking to profiles.
  - Click an AI player (e.g. "Opus 4.8") on the leaderboard → profile renders with its seeded picks.

---

## Notes on reuse / boundaries

- The profile page deliberately omits `/me`'s personal-only sections (achievements, rivals/nemesis, celebration trigger).
- The bracket section shows actual per-round picks (green if the team advanced) rather than `/me`'s point-only chips, per the approved spec.
- No schema changes, no new design tokens, no follow/DM features.
