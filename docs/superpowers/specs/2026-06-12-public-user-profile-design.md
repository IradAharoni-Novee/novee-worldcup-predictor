# Public user profile (`/u/[userId]`) — design

## Goal

Let any signed-in user click another player and see that player's **locked**
predictions. A prediction is revealed only once its lock has passed, so nothing
copyable ever leaks. The page is a public, lock-filtered mirror of `/me`.

## Access & routing

- New route: `src/app/(authenticated)/u/[userId]/page.tsx`.
- Add `/u` to `PROTECTED_PREFIXES` in `src/auth.config.ts` so the edge
  middleware gates it like the other authenticated pages. The page also calls
  `auth()` and `redirect("/signin")` when there is no session (defense in
  depth).
- If `userId === session.user.id`, `redirect("/me")` — a user viewing
  themselves gets their full private view.
- Unknown `userId` → `notFound()` (404).
- AI bot players are real `User` rows with seeded predictions, so they need no
  special-casing — their profiles render through the same path. `UserAvatar`
  already renders their brand marks.

## The reveal rule

One rule, applied per section: a prediction is shown only if its lock has
passed, using the existing lock helpers each surface already uses:

| Section | Lock check | Source |
|---|---|---|
| Match predictions | `isLocked(match.kickoff, now)` per match | `lib/format.ts` |
| Group predictions | per-group first kickoff passed | `getGroupLockTimes()` + `isLocked` |
| Bracket | `isBracketLocked(now)` | `lib/locks.ts` |
| Tournament awards | `isTournamentLocked(now)` | `lib/locks.ts` |

Points and totals are already fully public (leaderboard), so the **stats
header is always shown** regardless of lock state.

## Sections (mirrors `/me`, minus the personal bits)

The public profile reuses `/me`'s section layout for: stats header, tournament
awards, group predictions, bracket, match predictions. It **omits** the
personal-only parts of `/me`: achievements, rivals/nemesis, and the celebration
trigger.

1. **Header / stats** — `UserAvatar`, name (fallback to email local-part),
   leaderboard rank, and total + per-surface points (match / group / bracket /
   awards). Sourced from `getLeaderboard()`: find the row whose `userId`
   matches; rank is its index + 1. This guarantees the numbers match the
   leaderboard exactly. (Querying all users once is fine at this app's scale —
   the same call already backs `/me` and `/leaderboard`.)

2. **Tournament awards** — shown only once `isTournamentLocked()`. Reveals the
   player's tournament-winner pick (team name + flag) and golden-boot pick
   (player name + `PlayerAvatar`), plus points if the actual result is graded
   (`SETTING_KEY_ACTUAL_WINNER` / `SETTING_KEY_ACTUAL_GOLDEN_BOOT`). Before
   lock: an empty hint ("Hidden until the tournament kicks off").

3. **Group predictions** — for each group whose lock has passed, reveal the
   player's actual 1st–4th ranking (team names + flags via the `team1st..team4th`
   relations on `GroupPrediction`), plus the group score
   (`scoreGroupPrediction`) once the group has finished. Groups still locked
   open are not listed. If no group is revealed yet, show an empty hint.

4. **Bracket** — shown only once `isBracketLocked()`. **Compact per-round
   reveal:** for each knockout round (R32 → R16 → QF → SF → THIRD → FINAL), list
   the teams the player picked to reach that round (from `BracketPick`, grouped
   by `round`). Each team chip is colored green when that team actually advanced
   to that round and grey otherwise, using `computeAdvancers(knockoutMatches)`
   from `lib/scoring-bracket.ts`. The tournament-winner pick is **not** shown
   here — it is a separate surface rendered in the Tournament awards section.
   Before lock: an empty hint.

5. **Match predictions** — only matches that have kicked off
   (`isLocked(kickoff)`), ordered by kickoff. For each: stage chip, kickoff,
   teams, the player's predicted score, and status line — actual score + points
   if `FINISHED`, "Live" if in play, otherwise "Upcoming". If the prediction has
   a note, render it third-person: `"Name said: “…”"`.

## De-anonymize match-detail hot takes

On `src/app/(authenticated)/matches/[id]/page.tsx`, the post-kickoff "hot takes"
list is currently anonymous. Extend it to attribute and link authors:

- Add `user: { select: { id: true, name: true, image: true, email: true } }` to
  the `hotTakes` Prisma `select`.
- In the hot-takes rendering (the component that displays note + score), prepend
  a clickable `UserAvatar` + name linking to `/u/[author.id]`.
- No new privacy surface: hot takes already only appear once the match is
  locked, and already exclude the current user's own note.

## Testable core

Extract the pure reveal logic into `src/lib/profile-visibility.ts` so it can be
unit-tested independently of the server component:

- `revealedMatchPredictions(predictions, now)` → only locked matches.
- `revealedGroups(groupPredictions, groupLockTimes, now)` → only locked groups.
- `isAwardsRevealed(tournamentLockTime, now)` / `isBracketRevealed(bracketLockTime, now)`.

Cover these in `tests/profile-visibility.test.ts` (vitest, `node` env, `@/*`
alias) — matching the repo convention of keeping pure logic tested in `tests/`.
Edge cases: empty inputs, a kickoff exactly equal to `now` (locked, since
`isLocked` is `!isAfter`), a mix of locked/unlocked, and null lock times (no
matches seeded → not revealed).

## Reuse & boundaries

- Reuse existing UI primitives: `PageContainer`, `Card`, `Chip`, `UserAvatar`,
  `PlayerAvatar`, and the scoring helpers (`scorePrediction`,
  `scoreGroupPrediction`, `scoreBracketPicks`, `scoreAwards`, `computeAdvancers`,
  `computeGroupStandings`). No new design tokens.
- No edits to `/me` beyond nothing (left as-is); no follow/DM/notification
  features; no schema changes.

## Error handling

- Missing user → `notFound()`.
- A player with no revealed predictions yet (early tournament) → each section
  shows its empty hint rather than erroring.
- Reuse `withRetry` for the DB reads if following the match-detail pattern for
  transient Neon errors.
