/**
 * Identity helpers for seeded non-human leaderboard entries. These emails are
 * created by `prisma/seed.ts` and represent AI shadow players plus the 0-0
 * monument "VeeVee's Cousin".
 */

export const AI_PLAYER_EMAILS = {
  opus: "opus-4.8@novee.security",
  gpt: "gpt-5.5@novee.security",
  gemini: "gemini-3.5-flash@novee.security",
  cousin: "veevees-cousin@novee.security",
} as const;

export type AiPlayerKind = "opus" | "gpt" | "gemini" | "cousin" | null;

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

// Vercel AI Gateway model IDs for the LLM-backed players. The cousin is
// rule-based (always 0-0) so it has no model. Used by `prisma/seed.ts` to
// generate real predictions for each player.
export const AI_PLAYER_MODEL_IDS = {
  opus: "anthropic/claude-opus-4-8",
  gpt: "openai/gpt-5.5",
  gemini: "google/gemini-3.5-flash",
} as const satisfies Record<Exclude<AiPlayerKind & string, "cousin">, string>;
