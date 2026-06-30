# API-Football as sole score authority + penalty-shootout display

Date: 2026-06-30
Status: approved

## Problem

Two knockout matches showed wrong scores:

- Germany vs Paraguay — should be 1-1 (120'), Paraguay through 4-3 on penalties.
- Netherlands vs Morocco — should be 1-1 (120'), Morocco through 3-2 on penalties.

Root cause: `syncFromFootballData` stores `score.fullTime`, but football-data.org
**folds the shootout into `fullTime`** for penalty-decided knockouts (it reported
the 1-1 + 3-4 shootout as `fullTime` 4-5). The daily FD sync then overwrote the
correct 1-1 that the per-minute API-Football sync had already written, because
`reconcileScore` lets FD win once it carries any score.

API-Football, by contrast, reports the clean 120' score in `goals` (1-1) and keeps
the shootout in a separate `score.penalty` field — verified against the live feed
for both matches.

## Decision

Make **API-Football the sole authority for match results** (score, status,
advancement, penalties). football-data.org keeps doing what it's good at —
structure: the canonical fixture list, stages, groups, kickoffs, team crests, and
squads. We do **not** re-key anything: `fdId` stays the unique key on Team / Match
/ Player.

This removes the two-feed reconciliation surface that caused the bug, rather than
patching FD's `fullTime` parsing.

We also surface the shootout score in the UI, which requires storing it.

## Scope

### Data model
- Add `penaltyHome Int?` and `penaltyAway Int?` to `Match`. Null for every
  non-shootout match. The 120' score stays in `homeScore`/`awayScore`;
  `advancingTeamId` is unchanged.
- Migration: `add-penalty-score`.
- Scoring is untouched. `scoreShootoutBonus` still keys off a level
  `homeScore`/`awayScore` + `advancingTeamId`; penalties are display-only.

### API-Football client (`src/lib/api-football.ts`)
- Add `penaltyHome` / `penaltyAway` to `AfFixture`, read from
  `score.penalty.{home,away}` (null when no shootout).

### Sync (`src/lib/sync.ts`)
- `syncLiveScores` (per-minute) becomes the sole result authority: it already
  writes `homeScore`/`awayScore`/`status`/`advancingTeamId`; add
  `penaltyHome`/`penaltyAway`.
- `syncFromFootballData` stops writing results: drop `homeScore`, `awayScore`,
  and `advancingTeamId` from its upsert, and stop overwriting `status` on update.
  It keeps syncing structure (stage, group, kickoff, teams).
- Remove now-dead code: `reconcileScore`, `fdWinnerToTeamId`, and the
  `scoreBeforeShootout` helper + `penalties` field added to `FdScore` during the
  initial investigation. Drop their tests. Keep `reconcileTeamId` (FD still owns
  teams) and `mapStage`/`mapStatus`/`groupCode`.

### UI
Render a muted `Penalties: H–A` line (home–away order, matching the score) only
when both penalty values are present, on:
- the match card (`src/components/match/match-card.tsx`) — feeds from the
  `/matches` list,
- the match detail page (`src/app/(authenticated)/matches/[id]/page.tsx`),
- the per-match result rows on `/me` and `/u/[userId]`.

Thread `penaltyHome`/`penaltyAway` through `MatchCardProps` and the queries that
build those views.

### Retroactive data fix
- **Done already (operational):** both matches corrected to 1-1 in prod with the
  correct `advancingTeamId` (Paraguay, Morocco), so users stop seeing the wrong
  score immediately.
- **After the migration deploys:** a committed `prisma/` backfill pulls penalties
  from API-Football for finished shootout matches and writes
  `penaltyHome`/`penaltyAway` (3-4 and 2-3), so the new line populates.

## Out of scope
- Full migration of fixtures/teams/squads off football-data.org (would re-key
  Team/Match/Player off `fdId`; high risk mid-tournament — revisit later).
- Any change to the scoring config or bracket logic.

## Testing
- Add an API-Football `normalise` test asserting `score.penalty` → penalty fields,
  including the null (no-shootout) case.
- Remove `reconcileScore` / `scoreBeforeShootout` tests with their code.
- Existing scoring/bracket/leaderboard tests must stay green (penalties don't
  affect scoring).
- UI is verified by running the app (no component test harness in the repo).
