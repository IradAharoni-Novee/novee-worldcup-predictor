/**
 * VeeVee's voice — the cosmic-oracle mascot copy library.
 *
 * Lines are picked deterministically from a (seed, category, day) tuple so the
 * same teammate sees the same one all day but it rotates daily. Pass the user
 * id (or email) as the seed; pass undefined to share the same line across
 * everyone for that day.
 *
 * To add a Novee-specific touch, fill in NOVEE_VOICE_TUNING below. Lines that
 * reference {{CATCHPHRASE}} are dropped from the pool when the catchphrase is
 * empty — so VeeVee never says "{{CATCHPHRASE}}" out loud.
 */

// TODO(novee): replace these placeholders once Shira & co. send the real material.
// Grep for "[REPLACE_ME" to find every spot they affect in the UI.
export const NOVEE_VOICE_TUNING = {
  // Recurring phrase / meme — splices into VeeVee's voice. Empty string drops
  // the line entirely; a placeholder makes the line show up in the UI.
  catchphrase: "[REPLACE_ME: a recurring Slack phrase]",
  // A teammate known for a specific take. Used in achievement copy on /me.
  personName: "[REPLACE_ME: teammate]",
  // A past internal moment / running gag. Shows up in the Cmd+K command palette.
  moment: "[REPLACE_ME: an internal moment]",
  // A pet topic / opinion VeeVee can riff on. Reserved for the weekly digest.
  opinion: "[REPLACE_ME: a hot topic]",
};

export type VoiceCategory =
  | "emptyMe"
  | "emptyMatches"
  | "emptyLeaderboard"
  | "emptyGroups"
  | "emptyBracket"
  | "emptyAwards"
  | "saveToast"
  | "lockedConfirm"
  | "firstSignIn"
  | "loading"
  | "konami"
  | "hotTakeReveal"
  | "consensus"
  | "contrarian";

const LINES: Record<VoiceCategory, readonly string[]> = {
  emptyMe: [
    "VeeVee sees no predictions yet. The void looks back.",
    "Nothing here. VeeVee is patient. The cosmos less so.",
    "An empty slate. Brief, like the tournament's pre-match silence.",
    "VeeVee senses potential. Mostly unrealised. {{CATCHPHRASE}}",
  ],
  emptyMatches: [
    "No matches in this orbit. VeeVee waits.",
    "Nothing here. Try a different tab — or the cosmos.",
    "The fixture list is empty. The cosmos is mildly disappointed.",
  ],
  emptyLeaderboard: [
    "No scores yet. VeeVee is sharpening its quill.",
    "The board is blank. Everyone is equal. Briefly.",
    "Predictions exist. Outcomes do not. Yet.",
  ],
  emptyGroups: [
    "No groups configured. VeeVee senses an admin somewhere.",
    "The rankings are unwritten. Pick up a pen.",
  ],
  emptyBracket: [
    "An empty bracket is a pristine bracket. It will not last.",
    "VeeVee senses 32 possibilities. Choose. Or don't.",
  ],
  emptyAwards: [
    "No award picks yet. The trophy room remains theoretical.",
    "VeeVee awaits your hot take on the whole tournament.",
  ],
  saveToast: [
    "Locked in. The cosmos disapproves but respects your conviction.",
    "Saved. May fate be slightly amused.",
    "VeeVee files this under 'bold'.",
    "Noted. VeeVee remembers everything. {{CATCHPHRASE}}",
    "Done. The bracket trembles, faintly.",
  ],
  lockedConfirm: [
    "Locked. The match has begun. VeeVee cannot help you now.",
    "The whistle blew. So did your chance to edit.",
  ],
  firstSignIn: [
    "Welcome. VeeVee has been waiting. Patiently. For four years.",
    "You have arrived. The cosmos was getting bored.",
  ],
  loading: [
    "VeeVee is consulting the league tables of fate.",
    "Spinning the cosmic conic-gradient. One moment.",
  ],
  konami: [
    "You found the cheat code. There is no cheat for the bracket.",
    "VeeVee acknowledges the gesture. The bracket does not.",
  ],
  hotTakeReveal: [
    "You said this. The record stands.",
    "VeeVee remembers everything. Including this.",
    "This aged like milk in a stadium.",
  ],
  consensus: [
    "You picked with the crowd. Safe is fine. Safe is fine.",
    "VeeVee notes: you are not alone.",
  ],
  contrarian: [
    "Bold. Lonely. Possibly correct.",
    "VeeVee respects a hot take. The leaderboard does not.",
  ],
};

function expand(line: string): string | null {
  if (!line.includes("{{")) return line;
  if (line.includes("{{CATCHPHRASE}}")) {
    const phrase = NOVEE_VOICE_TUNING.catchphrase;
    if (!phrase) return null;
    return line.replaceAll("{{CATCHPHRASE}}", phrase);
  }
  return line;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pick a stable VeeVee line for the given category, seeded so the same
 * (seed, category, day) returns the same string but rotates daily.
 *
 * @param category which set of lines to pull from
 * @param seed optional per-user seed (e.g. user id or email). Omit for a
 *   site-wide line that's the same for everyone on a given day.
 * @returns a single line, never null
 */
export function veeveeLine(category: VoiceCategory, seed?: string): string {
  const candidates = LINES[category]
    .map(expand)
    .filter((s): s is string => s !== null);
  const pool = candidates.length > 0 ? candidates : LINES[category];
  const key = `${seed ?? "shared"}:${category}:${todayKey()}`;
  const idx = hash(key) % pool.length;
  return pool[idx]!;
}
