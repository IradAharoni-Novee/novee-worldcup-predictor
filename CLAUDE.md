# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm**. Node uses ESM (`"type": "module"`).

```bash
pnpm dev                # Next.js dev server (http://localhost:3000)
pnpm build              # prisma generate + next build (build always regenerates the client)
pnpm start              # production server

pnpm lint               # next lint (ESLint)
pnpm type-check         # tsc --noEmit
pnpm test               # vitest run (scoring + bracket + group standings)
pnpm test:watch         # vitest watch mode
pnpm vitest run tests/scoring.test.ts          # single test file
pnpm vitest run -t "exact score"               # single test by name

pnpm prisma:migrate     # prisma migrate dev (creates + applies a new migration)
pnpm prisma:generate    # regenerate the Prisma client
pnpm prisma:studio      # open Prisma Studio
pnpm seed               # tsx prisma/seed.ts — pulls fixtures + 48 teams from football-data.org
```

One-off scripts in `prisma/` are run with `pnpm exec tsx prisma/<file>.ts` (e.g. `backfill-slack-photos.ts`, `cleanup-bracket-picks.ts`, `sync-squad-photos.ts`).

The `@/*` import alias resolves to `src/*` (configured in `tsconfig.json` and mirrored in `vitest.config.ts`).

## Architecture

Next.js 16 App Router + React 19 + TypeScript strict, Prisma 6 / Postgres, Auth.js v5 (next-auth beta), Tailwind v4. The styling layer (`src/styles/theme.css`, `src/components/ui/*`) is a verbatim port from the `@novee/ui` design system — do not invent new tokens; reuse the existing primitives and CVA patterns.

### Auth flow (two configs — important)

Auth.js is split because the middleware runs on the edge and can't import Node-only modules:

- `src/auth.config.ts` — **edge-safe.** Has no providers and no Prisma adapter. Only the `authorized` callback gating `PROTECTED_PREFIXES` (`/matches`, `/bracket`, `/leaderboard`, `/me`, `/admin`). Imported by `src/middleware.ts`.
- `src/auth.ts` — **full config.** Adds Prisma adapter, Resend magic-link provider, Credentials (email + password) provider, JWT session strategy, and the `signIn` / `jwt` / `session` callbacks that propagate `userId` + `isAdmin` into the token. The `createUser` event does a best-effort Slack profile lookup and DMs a welcome from "VeeVee".

Sign-in is restricted to `@novee.security` emails via `src/lib/email-allowlist.ts` — both the Credentials `authorize` step and the `signIn` callback enforce this. Magic links in dev are stashed on `globalThis.__devMagicLink` and printed to the console.

### Prediction domain

Five separate prediction surfaces, each with its own model, server action, scoring module, and lock rules:

| Surface | Model(s) | Server action | Scoring | Lock |
|---|---|---|---|---|
| Per-match score | `Prediction` | `lib/actions/predictions.ts` | `lib/scoring.ts` | per-match kickoff |
| Group standings (1st–4th) | `GroupPrediction` | `lib/actions/group-predictions.ts` | `lib/scoring-groups.ts` | first kickoff in that group (`isGroupLocked`) |
| Knockout bracket | `BracketPick` (round + slot) | `lib/actions/bracket-predictions.ts` | `lib/scoring-bracket.ts` | first R32 (or R16 fallback) kickoff (`isBracketLocked`) |
| Tournament winner + Golden Boot | `TournamentWinnerPrediction`, `GoldenBootPrediction` | `lib/actions/awards.ts` | `lib/scoring-awards.ts` | first kickoff of the tournament |
| 3rd-place qualifiers | `ThirdPlaceQualifierPick` | `lib/actions/third-place-qualifiers.ts` | `lib/scoring-awards.ts` | first kickoff of the tournament |

Locks live in `src/lib/locks.ts` and ultimately delegate to `isLocked(kickoff, now)` in `lib/format.ts` (a prediction is locked once `kickoff <= now`). Every server action must re-check the lock before writing.

`lib/scoring.ts` defines `ScoringConfig` and `DEFAULT_SCORING`. The active config is stored in the `Setting('scoring')` row as JSON and loaded per request — never hard-code points anywhere else. Knockout matches get a multiplier (default ×2) applied to per-match points.

### Data sync

`src/lib/football-data.ts` wraps the football-data.org v4 API; `src/lib/sync.ts` upserts teams + matches and normalises FD stage codes (`GROUP_STAGE`/`LAST_32`/`LAST_16`/`ROUND_OF_16`/`QUARTER_FINALS`/`SEMI_FINALS`/`THIRD_PLACE`/`FINAL`) into the `Stage` enum. Group codes from FD arrive as `GROUP_A` or `Group A` — `sync.ts` normalises both to a single letter.

`/api/cron/sync` is invoked daily at 06:00 UTC by `vercel.json` and requires the `Authorization: Bearer $CRON_SECRET` header. Admins can also trigger it on demand from `/admin/sync`.

### App routing

```
src/app/
├── page.tsx, signin/, set-password/        # public
└── (authenticated)/                        # session-gated by middleware
    ├── matches/  bracket/  groups/  awards/  me/  leaderboard/  cosmos/
    └── admin/                              # additional isAdmin gate in layout.tsx
        ├── matches/  users/  sync/  awards/
```

Admin status comes from `session.user.isAdmin` (set in the `jwt` callback from the DB on first sign-in for that session). Promote a user via Prisma Studio or `prisma.user.update({ where: { email }, data: { isAdmin: true } })`.

### Other notable modules

- `lib/bracket-seeding.ts` / `lib/bracket-cleanup.ts` — derive bracket slots from group standings.
- `lib/group-standings.ts` — compute live group tables from `Match` results.
- `lib/leaderboard.ts` — aggregate every prediction surface into a single ranked total.
- `lib/pick-aggregates.ts` — histograms of how the user pool voted (used on match detail + bracket).
- `lib/achievements.ts` — badges surfaced on `/me`.
- `lib/ai-players.ts` — synthetic predictor "players" (e.g. all-draws bot) shown on the leaderboard for fun.
- `lib/veevee-voice.ts` — copy strings for the "VeeVee" mascot (used in DMs + UI flavour text).
- `lib/slack.ts` — optional Slack profile lookup (photo + display name) and bot DM. Silently no-ops without `SLACK_BOT_TOKEN`.
- `lib/password.ts` — bcrypt hashing for the Credentials provider; users set a password at `/set-password`.

### Tests

Vitest covers the pure scoring/seeding/standings logic (`tests/*.test.ts`). There's no end-to-end harness wired up; Playwright is installed but no specs are checked in. Tests run with `environment: "node"` and use the `@/*` alias.

## Env

Required: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `FOOTBALL_DATA_TOKEN`, `CRON_SECRET`.
Optional: `SLACK_BOT_TOKEN` (+ `SLACK_EMAIL_DOMAINS` fallback list) for first-sign-in profile lookup.

When changing the schema, always create a Prisma migration with `pnpm prisma:migrate` — `pnpm build` runs `prisma generate` but does not apply pending migrations.
