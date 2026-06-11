export const DISPLAY_NAME_MAX = 60;

export type ParsedDisplayName =
  | { ok: true; name: string | null }
  | { ok: false; error: string };

/**
 * Normalise a display-name form value. Trims whitespace; an empty result means
 * "clear the name" (stored as null). `null` input (a missing FormData field)
 * also clears. Anything non-string is rejected.
 */
export function parseDisplayName(input: unknown): ParsedDisplayName {
  if (input === null) return { ok: true, name: null };
  if (typeof input !== "string") {
    return { ok: false, error: "Invalid name." };
  }
  const trimmed = input.trim();
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      error: `Name must be ${DISPLAY_NAME_MAX} characters or fewer.`,
    };
  }
  return { ok: true, name: trimmed.length === 0 ? null : trimmed };
}
