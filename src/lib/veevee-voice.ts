/**
 * VeeVee's voice — the cosmic-oracle mascot copy library.
 *
 * Lines are picked deterministically from a (seed, category, day) tuple so the
 * same teammate sees the same one all day but it rotates daily. Pass the user
 * id (or email) as the seed; pass undefined to share the same line across
 * everyone for that day.
 *
 * Novee-specific flavor lives in NOVEE_VOICE_TUNING below. Lines that
 * reference {{CATCHPHRASE}}, {{PERSON}}, {{MOMENT}}, or {{OPINION}} are
 * dropped from the pool when the matching array is empty.
 *
 * Source for the strings in NOVEE_VOICE_TUNING: the #novee-memes Slack
 * archive — update them in this file directly when the lore evolves.
 */

export type TuningKey = "catchphrase" | "personName" | "moment" | "opinion";

export const NOVEE_VOICE_TUNING: Record<TuningKey, readonly string[]> = {
  // Recurring Slack phrases / memes — short enough to splice inline.
  catchphrase: ["LGTM", "LFG", "Cool Hatul", "GonBot Approves"],
  // Teammates with strong takes. Lidor gets memed the most; Or runs the
  // MemeKing factory; Barak thinks he's an expert.
  personName: ["Barak", "Lidor", "Dancig", "Ninburg"],
  // Inside moments that everyone in the office remembers.
  moment: [
    "Lidor stuck in Thailand for two months",
    "Omer and his sandals",
    "Chicken Station closed during the holiday",
    "End-of-month Bedrock bill",
    "box novee-tenant-dev vs box novee-tenant-prod",
    "Models team's 'it could take years' promise",
  ],
  // Hot opinions / pet debates the office keeps relitigating.
  opinion: [
    "Issue or Lead in Product",
    "Claude or Cursor",
    "Samuel or שמואל",
    "Backoffice or POV Explorer",
    "Novee V2 or VeeVee V3",
  ],
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
    "Empty page. {{PERSON}} would already have a hot take.",
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
    "Board's empty. So is Chicken Station, apparently.",
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
    "Locked in. {{PERSON}} would never.",
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
    "Receipts kept. Filed next to {{MOMENT}}.",
  ],
  consensus: [
    "You picked with the crowd. Safe is fine. Safe is fine.",
    "VeeVee notes: you are not alone.",
    "Picked with the crowd. Like everyone arguing about {{OPINION}}.",
  ],
  contrarian: [
    "Bold. Lonely. Possibly correct.",
    "VeeVee respects a hot take. The leaderboard does not.",
  ],
};

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
 * Pick one entry from NOVEE_VOICE_TUNING[key] deterministically per
 * (seed, key, day). Returns null when the array is empty so callers can
 * fail-soft (drop the line, skip the achievement, etc.).
 */
export function noveeTuning(key: TuningKey, seed?: string): string | null {
  const pool = NOVEE_VOICE_TUNING[key];
  if (pool.length === 0) return null;
  const idx = hash(`${seed ?? "shared"}:tuning:${key}:${todayKey()}`) % pool.length;
  return pool[idx]!;
}

const TOKEN_TO_KEY: Record<string, TuningKey> = {
  "{{CATCHPHRASE}}": "catchphrase",
  "{{PERSON}}": "personName",
  "{{MOMENT}}": "moment",
  "{{OPINION}}": "opinion",
};

function expand(line: string, seed?: string): string | null {
  if (!line.includes("{{")) return line;
  let out = line;
  for (const [token, key] of Object.entries(TOKEN_TO_KEY)) {
    if (!out.includes(token)) continue;
    const value = noveeTuning(key, seed);
    if (value === null) return null;
    out = out.replaceAll(token, value);
  }
  return out;
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
    .map((line) => expand(line, seed))
    .filter((s): s is string => s !== null);
  const pool = candidates.length > 0 ? candidates : LINES[category];
  const key = `${seed ?? "shared"}:${category}:${todayKey()}`;
  const idx = hash(key) % pool.length;
  return pool[idx]!;
}
