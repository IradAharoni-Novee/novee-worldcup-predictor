import { describe, expect, it } from "vitest";
import {
  isAwardsRevealed,
  isBracketRevealed,
  revealedGroups,
  revealedMatchPredictions,
} from "@/lib/profile-visibility";

const T = (iso: string) => new Date(iso);

describe("revealedMatchPredictions", () => {
  const now = T("2026-06-12T12:00:00Z");

  it("keeps predictions whose match kicked off at or before now", () => {
    const preds = [
      { id: "a", match: { kickoff: T("2026-06-12T11:00:00Z") } },
      { id: "b", match: { kickoff: T("2026-06-12T12:00:00Z") } },
      { id: "c", match: { kickoff: T("2026-06-12T13:00:00Z") } },
    ];
    expect(revealedMatchPredictions(preds, now).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns empty for empty input", () => {
    expect(revealedMatchPredictions([], now)).toEqual([]);
  });
});

describe("isAwardsRevealed / isBracketRevealed", () => {
  const now = T("2026-06-12T12:00:00Z");

  it("is false when the lock time is null (nothing seeded)", () => {
    expect(isAwardsRevealed(null, now)).toBe(false);
    expect(isBracketRevealed(null, now)).toBe(false);
  });

  it("is true once the lock time has passed", () => {
    expect(isAwardsRevealed(T("2026-06-12T11:59:59Z"), now)).toBe(true);
    expect(isBracketRevealed(T("2026-06-12T11:59:59Z"), now)).toBe(true);
  });

  it("is true at exactly the lock time", () => {
    expect(isAwardsRevealed(now, now)).toBe(true);
    expect(isBracketRevealed(now, now)).toBe(true);
  });

  it("is false before the lock time", () => {
    expect(isAwardsRevealed(T("2026-06-12T12:00:01Z"), now)).toBe(false);
    expect(isBracketRevealed(T("2026-06-12T12:00:01Z"), now)).toBe(false);
  });
});

describe("revealedGroups", () => {
  const now = T("2026-06-12T12:00:00Z");
  const locks = new Map<string, Date>([
    ["A", T("2026-06-12T11:00:00Z")],
    ["B", T("2026-06-12T13:00:00Z")],
  ]);

  it("keeps only groups whose first kickoff has passed", () => {
    const gps = [{ group: "A" }, { group: "B" }];
    expect(revealedGroups(gps, locks, now).map((g) => g.group)).toEqual(["A"]);
  });

  it("hides groups with no known lock time", () => {
    expect(revealedGroups([{ group: "C" }], locks, now)).toEqual([]);
  });
});
