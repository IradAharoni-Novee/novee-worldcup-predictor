/**
 * Identity helpers for seeded non-human leaderboard entries. These emails are
 * created by `prisma/seed.ts` and represent AI shadow players plus the 0-0
 * monument "VeeVee's Cousin".
 */

export const AI_PLAYER_EMAILS = {
  opus: "opus-4.7@novee.security",
  gpt: "gpt-5.5@novee.security",
  cousin: "veevees-cousin@novee.security",
} as const;

export const AI_PLAYER_EMAIL_SET: ReadonlySet<string> = new Set(
  Object.values(AI_PLAYER_EMAILS)
);

export type AiPlayerKind = "opus" | "gpt" | "cousin" | null;

export function aiPlayerKind(email: string | null | undefined): AiPlayerKind {
  if (!email) return null;
  const e = email.toLowerCase();
  for (const [kind, addr] of Object.entries(AI_PLAYER_EMAILS)) {
    if (addr === e) return kind as AiPlayerKind;
  }
  return null;
}

export function isAiPlayer(email: string | null | undefined): boolean {
  return aiPlayerKind(email) !== null;
}
