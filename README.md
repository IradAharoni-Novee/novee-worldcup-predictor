# World Cup 2026 Match Predictor

A private match-predictor game for friends and family to play during the **FIFA World Cup 2026** (June 11 – July 19, 2026). Players sign in via magic-link, pick a score for every match before kickoff, and accrue points on a shared leaderboard.

Visually styled to match the [novee](https://novee.io) webapp — same theme tokens, Inter typography, brand purple, and primitive components.

## Stack

- **Next.js 16** App Router · **React 19** · **TypeScript** strict
- **Tailwind v4** with `theme.css` copied verbatim from `@novee/ui`
- **Prisma 6** + **Postgres** (Neon recommended)
- **Auth.js v5** with **Resend** magic-link email
- **football-data.org** v4 API for fixtures and live results (Vercel Cron syncs daily)
- **Vitest** for the scoring function; **Playwright** for end-to-end (optional)

## Quick start

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, FOOTBALL_DATA_TOKEN, CRON_SECRET
pnpm prisma migrate dev --name init
pnpm seed       # one-time: pulls all 104 fixtures + 48 teams
pnpm dev
```

Open <http://localhost:3000>. Sign in with any email — the magic link will arrive via Resend.

## Required environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Neon free tier is enough. |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | [resend.com](https://resend.com) — free tier covers ~3K emails/mo. |
| `AUTH_EMAIL_FROM` | Sender for magic-link emails, e.g. `"Predictor <noreply@yourdomain.com>"`. |
| `FOOTBALL_DATA_TOKEN` | Free token from [football-data.org](https://www.football-data.org/client/register). |
| `CRON_SECRET` | `openssl rand -hex 32`. Used by `/api/cron/sync`. |

## Making yourself an admin

After signing in for the first time, promote your user via the Prisma Studio or a one-liner:

```bash
pnpm prisma studio
# or:
pnpm exec tsx -e 'import { prisma } from "@/lib/prisma"; await prisma.user.update({ where: { email: "you@example.com" }, data: { isAdmin: true } });'
```

Admins see the **Admin** nav link and can:
- Override match results inline at `/admin/matches`
- Promote or demote users at `/admin/users`
- Trigger an on-demand sync from football-data.org at `/admin/sync`

## Scoring

Configured at `src/lib/scoring.ts` and stored as JSON in the `Setting('scoring')` row. Default:

- **3 points** — exact score
- **1 point** — correct outcome only (win / draw / loss)
- **× 2 multiplier** on every knockout match (R32 → Final)

To tweak, update the row in the DB; the scoring function reads it on every page load.

## Deploy on Vercel

1. Push to a GitHub repo, import in Vercel.
2. Add all env vars from the `.env.example`.
3. Make sure the Neon project's `DATABASE_URL` includes `?sslmode=require`.
4. The `vercel.json` already declares a daily cron at 06:00 UTC hitting `/api/cron/sync`. Vercel adds an `Authorization: Bearer <CRON_SECRET>` header automatically when `CRON_SECRET` is set.

## Tests

```bash
pnpm test           # vitest: scoring function (10 tests)
pnpm type-check     # tsc --noEmit
```

End-to-end Playwright specs live in `tests/e2e/` and require the dev stack to be running. They're optional.

## Project layout

```
src/
├── app/
│   ├── page.tsx                       # landing
│   ├── signin/page.tsx                # magic-link form
│   ├── (authenticated)/
│   │   ├── layout.tsx                 # session-gated shell + TopBar
│   │   ├── matches/                   # list + detail + prediction form
│   │   ├── bracket/                   # column-per-stage knockout view
│   │   ├── leaderboard/               # ranked table
│   │   ├── me/                        # personal history + total points
│   │   └── admin/                     # matches/users/sync (isAdmin only)
│   └── api/
│       ├── auth/[...nextauth]/        # Auth.js handlers
│       └── cron/sync/                 # daily fixture+result pull
├── auth.config.ts                     # edge-safe Auth.js config
├── auth.ts                            # full config w/ Prisma adapter
├── proxy.ts                           # gate protected routes (edge)
├── components/
│   ├── ui/                            # Button, Card, Chip, Input, Dialog, …
│   ├── shell/                         # TopBar, PageContainer, PageTitle
│   ├── match/                         # MatchCard, PredictionForm
│   └── admin/                         # admin action forms
├── lib/
│   ├── prisma.ts                      # singleton client
│   ├── scoring.ts                     # pure scoring function (unit-tested)
│   ├── football-data.ts               # v4 API client
│   ├── sync.ts                        # upsert teams + matches
│   ├── leaderboard.ts                 # ranked aggregation
│   ├── format.ts                      # date + stage-label helpers
│   ├── cn.ts                          # Tailwind classname merge
│   └── actions/                       # server actions
└── styles/theme.css                   # copied verbatim from @novee/ui

prisma/
├── schema.prisma
└── seed.ts
```

## Design system

`src/styles/theme.css` is a verbatim copy of `frontend/packages/ui/theme.css` from the novee monorepo. All design tokens — color palette, font scale, spacing, radius, dark-mode overrides — live there. The components in `src/components/ui/` are direct adaptations of the novee primitives (`Button`, `Card`, `Chip`, etc.) using the same CVA + Tailwind patterns.

Icons use [lucide-react](https://lucide.dev) instead of FontAwesome to avoid the private FontAwesome token required by the novee monorepo. Visually they're a close match.

If you want to pick up updates from the novee design system, re-copy `theme.css` and re-derive any components you need:

```bash
cp ../novee/frontend/packages/ui/theme.css src/styles/theme.css
```

## Not affiliated with FIFA. Built for fun.
