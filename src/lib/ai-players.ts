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

export const AI_PLAYER_EMAIL_SET: ReadonlySet<string> = new Set(
  Object.values(AI_PLAYER_EMAILS)
);

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

// Brand-mark avatars for the seeded players, keyed by email local-part prefix
// so they stay correct on any DB without a stored image or a backfill. Single
// source of truth shared by the live UI (`UserAvatar`) and the OG reminder
// card, which load the SVG differently — a public URL in the browser vs. a
// disk-inlined data URI in Satori — but must agree on which mark each gets.
const AI_PLAYER_AVATARS: ReadonlyArray<{
  test: (local: string) => boolean;
  file: string;
  label: string;
}> = [
  { test: (l) => l.startsWith("opus-") || l.startsWith("claude"), file: "anthropic.svg", label: "Anthropic" },
  { test: (l) => l.startsWith("gpt-") || l.startsWith("chatgpt"), file: "openai.svg", label: "OpenAI" },
  { test: (l) => l.startsWith("gemini-"), file: "gemini.svg", label: "Google Gemini" },
  { test: (l) => l.startsWith("veevees-cousin"), file: "cousin.svg", label: "VeeVee's Cousin" },
];

/**
 * Brand-mark avatar for a seeded AI player.
 *
 * @returns The SVG filename under `public/avatars/` plus alt text, or null for
 *   human users (who fall back to their photo or initials).
 */
export function aiPlayerAvatar(
  email: string | null | undefined
): { file: string; label: string } | null {
  if (!email) return null;
  const local = email.toLowerCase();
  return AI_PLAYER_AVATARS.find((a) => a.test(local)) ?? null;
}

// Vercel AI Gateway model IDs for the LLM-backed players. The cousin is
// rule-based (always 0-0) so it has no model. Used by `prisma/seed.ts` to
// generate real predictions for each player.
export const AI_PLAYER_MODEL_IDS = {
  opus: "anthropic/claude-opus-4-8",
  gpt: "openai/gpt-5.5",
  gemini: "google/gemini-3.5-flash",
} as const satisfies Record<Exclude<AiPlayerKind & string, "cousin">, string>;
