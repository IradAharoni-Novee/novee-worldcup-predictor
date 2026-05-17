// Single source of truth for CTF flag values. Every planted flag in the
// codebase (security.txt, JWT cookie payload, GraphQL responses, status
// endpoint, timing oracle) imports from here, and the seed script writes the
// same rows into CtfFlag. Drift between "where the flag is planted" and "what
// the DB accepts" is impossible by construction.

export type FlagDefinition = {
  slug: string;
  code: string;
  points: number;
  hint: string;
  discoveryHint: string;
};

export const FLAGS = {
  wellKnown: {
    slug: "well-known",
    code: "novee{well_known_is_well_fun}",
    points: 10,
    hint:
      "Real pentesters always check /.well-known/ first. Don't forget to decode.",
    discoveryHint:
      "Pull /.well-known/security.txt and look at every line. Some bytes are encoded.",
  },
  jwt: {
    slug: "jwt",
    code: "veevee{first_lesson_jwts_are_not_encrypted}",
    points: 20,
    hint:
      "alg:none is the only authentication scheme VeeVee respects. Base64url isn't crypto.",
    discoveryHint:
      "Inspect the cookies set on the public landing page. One looks suspiciously like a token.",
  },
  graphql: {
    slug: "graphql",
    code: "novee{introspection_reveals_more_than_intended}",
    points: 20,
    hint:
      "Schema descriptions are documentation, and documentation is a side-channel.",
    discoveryHint:
      "POST a GraphQL introspection query to /api/ctf/q. Read the field descriptions. Compute what they ask for.",
  },
  debug: {
    slug: "debug",
    code: "veevee{vary_means_try_me}",
    points: 15,
    hint: "When a server says it cares about a header, it cares for a reason.",
    discoveryHint:
      "Send HEAD or OPTIONS to /api/ctf/status and read every response header. One of them names the knob.",
  },
  timing: {
    slug: "timing",
    code: "novee{timing_is_a_side_channel}",
    points: 25,
    hint:
      "The server tells you nothing useful in the body, but the clock never lies.",
    discoveryHint:
      "POST to /api/ctf/sieve with { guess: \"...\" }. Measure response time. Extract one character at a time.",
  },
} as const satisfies Record<string, FlagDefinition>;

export type FlagSlug = keyof typeof FLAGS;

export const FLAG_LIST: readonly FlagDefinition[] = Object.values(FLAGS);

export const TOTAL_FLAGS = FLAG_LIST.length;
export const TOTAL_POINTS = FLAG_LIST.reduce((sum, f) => sum + f.points, 0);

// Slugs that previously existed but have been retired. The seed deletes these
// (cascading to any captures) so the leaderboard doesn't carry phantom rows.
export const RETIRED_FLAG_SLUGS: readonly string[] = [
  "robots",
  "landing",
  "header",
  "console",
  "cosmos",
  "manifest",
];

// Normalise user input so common copy/paste variants still match: trim
// whitespace, drop wrapping quotes, lowercase. The seeded codes are lowercase.
export function normaliseFlagInput(input: string): string {
  return input
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .toLowerCase();
}

export function findFlagByCode(input: string): FlagDefinition | null {
  const candidate = normaliseFlagInput(input);
  if (!candidate) return null;
  return FLAG_LIST.find((f) => f.code === candidate) ?? null;
}
