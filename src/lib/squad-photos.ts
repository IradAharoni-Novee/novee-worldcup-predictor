// Pure helpers for the FIFA squad-photo sync (prisma/sync-squad-photos.ts).
// Kept free of Prisma/Playwright so the matching logic is unit-testable.
//
// FIFA serves player headshots from digitalhub.fifa.com via this pattern:
//   https://digitalhub.fifa.com/transform/<GUID>/<filename>?...&width:<N>&quality=75
// and labels each player's <img> with alt="Firstname LASTNAME". Our DB roster
// comes from football-data.org, which often uses fuller legal names in a
// different order, so matching has to tolerate diacritics, reordering, and
// extra middle/family names without producing false matches.

export type NameCandidate = { id: string; name: string };

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-zA-Z]+/g, " ")
    .trim()
    .toUpperCase();
}

export function nameTokens(name: string): string[] {
  const normalized = normalizeName(name);
  return normalized ? normalized.split(" ") : [];
}

export function pickWidth(srcset: string, preferredWidth: number): string | null {
  // srcset entries are "<url> <width>w" separated by commas, but the URLs
  // themselves contain commas (e.g. "transform:fill,aspectratio:1x1,...").
  // Match url+width pairs directly instead of splitting on commas.
  const matches = [...srcset.matchAll(/(https?:\/\/\S+?)\s+(\d+)w(?=\s*,|\s*$)/g)];
  let best: { url: string; width: number } | null = null;
  for (const m of matches) {
    const url = m[1]!;
    const width = parseInt(m[2]!, 10);
    if (!best || Math.abs(width - preferredWidth) < Math.abs(best.width - preferredWidth)) {
      best = { url, width };
    }
  }
  return best?.url ?? null;
}

function tokenSetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((token, i) => token === sortedB[i]);
}

// True when every token of `small` appears in `big` (multiset containment).
function isSubsetOf(small: string[], big: string[]): boolean {
  const pool = [...big];
  for (const token of small) {
    const idx = pool.indexOf(token);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

function onlyMatch(matches: NameCandidate[]): NameCandidate | null {
  return matches.length === 1 ? matches[0]! : null;
}

type Prepared = { candidate: NameCandidate; tokens: string[] };

// Tier: one name's tokens fully contain the other's, and the given names agree.
// Handles FIFA's short display name vs. football-data's fuller legal name
// (e.g. "Achraf HAKIMI" ↔ "Achraf Hakimi Mouh"). Only accepts a unique hit.
function matchBySubset(want: string[], prepared: Prepared[]): NameCandidate | null {
  const wantFirst = want[0];
  const hits = prepared.filter(({ tokens }) => {
    if (tokens.length === 0 || tokens[0] !== wantFirst) return false;
    return isSubsetOf(want, tokens) || isSubsetOf(tokens, want);
  });
  return onlyMatch(hits.map((h) => h.candidate));
}

// Tier: surnames (last token) agree. When FIFA gives a first name too, require
// the first initial to agree and be unique, so "Lautaro MARTINEZ" never lands
// on "Emiliano Martínez". Otherwise only accept a unique surname.
function matchBySurname(want: string[], prepared: Prepared[]): NameCandidate | null {
  const wantLast = want[want.length - 1];
  const wantFirstInitial = want.length > 1 ? want[0]![0] : null;
  const lastMatches = prepared.filter(({ tokens }) => tokens[tokens.length - 1] === wantLast);
  if (lastMatches.length === 0) return null;

  if (wantFirstInitial) {
    const narrowed = lastMatches.filter(({ tokens }) => tokens[0]?.[0] === wantFirstInitial);
    return onlyMatch(narrowed.map((m) => m.candidate));
  }
  return onlyMatch(lastMatches.map((m) => m.candidate));
}

// Resolve a FIFA-scraped player name to a DB roster entry, strongest/safest
// tiers first. Returns null rather than risk a wrong assignment.
export function matchPlayer(
  fifaName: string,
  candidates: NameCandidate[]
): NameCandidate | null {
  const want = nameTokens(fifaName);
  if (want.length === 0) return null;
  const wantStr = want.join(" ");

  const prepared: Prepared[] = candidates.map((candidate) => ({
    candidate,
    tokens: nameTokens(candidate.name),
  }));

  for (const { candidate, tokens } of prepared) {
    if (tokens.join(" ") === wantStr) return candidate;
  }

  const setEqual = prepared.filter(({ tokens }) => tokenSetEqual(tokens, want));
  if (setEqual.length === 1) return setEqual[0]!.candidate;

  return matchBySubset(want, prepared) ?? matchBySurname(want, prepared);
}
