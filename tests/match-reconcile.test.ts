import { describe, expect, it } from "vitest";
import {
  isoMinute,
  normaliseName,
  pickByTeamsAtMinute,
} from "@/lib/match-reconcile";

type Candidate = { id: number; homeName: string; awayName: string; date: string | Date };

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    id: 1,
    homeName: "Mexico",
    awayName: "South Africa",
    date: "2026-06-11T19:00:00+00:00",
    ...overrides,
  };
}

describe("normaliseName", () => {
  it("lowercases, strips diacritics and punctuation", () => {
    expect(normaliseName("Côte d’Ivoire")).toBe("cotedivoire");
    expect(normaliseName("Cote dIvoire")).toBe("cotedivoire");
    expect(normaliseName("Türkiye")).toBe("turkiye");
  });
});

describe("isoMinute", () => {
  it("truncates a Date to the minute in ISO form", () => {
    expect(isoMinute(new Date("2026-06-11T19:00:30Z"))).toBe("2026-06-11T19:00");
  });

  it("truncates a string timestamp to the minute", () => {
    expect(isoMinute("2026-06-11T19:00:00+00:00")).toBe("2026-06-11T19:00");
  });
});

describe("pickByTeamsAtMinute", () => {
  const target = {
    homeName: "Mexico",
    awayName: "South Africa",
    kickoff: new Date("2026-06-11T19:00:00Z"),
  };

  it("matches when both teams and the kickoff minute agree", () => {
    const c = pickByTeamsAtMinute(target, [candidate({ id: 42 })]);
    expect(c?.id).toBe(42);
  });

  it("matches diacritic- and punctuation-insensitively", () => {
    const ci = {
      homeName: "Côte d’Ivoire",
      awayName: "Brazil",
      kickoff: new Date("2026-06-11T19:00:00Z"),
    };
    const c = pickByTeamsAtMinute(ci, [
      candidate({ id: 5, homeName: "Cote dIvoire", awayName: "Brazil" }),
    ]);
    expect(c?.id).toBe(5);
  });

  it("matches regardless of home/away orientation", () => {
    const c = pickByTeamsAtMinute(target, [
      candidate({ id: 7, homeName: "South Africa", awayName: "Mexico" }),
    ]);
    expect(c?.id).toBe(7);
  });

  it("returns null when two candidates match both teams (ambiguous)", () => {
    const c = pickByTeamsAtMinute(target, [
      candidate({ id: 1 }),
      candidate({ id: 2, homeName: "South Africa", awayName: "Mexico" }),
    ]);
    expect(c).toBeNull();
  });

  it("accepts a single-team match when it is the sole same-minute candidate", () => {
    const c = pickByTeamsAtMinute(target, [
      candidate({ id: 99, homeName: "Mexico", awayName: "Korea Republic" }),
    ]);
    expect(c?.id).toBe(99);
  });

  it("returns null for a single-team match when two candidates share a team", () => {
    const c = pickByTeamsAtMinute(target, [
      candidate({ id: 1, homeName: "Mexico", awayName: "Korea Republic" }),
      candidate({ id: 2, homeName: "Brazil", awayName: "South Africa" }),
    ]);
    expect(c).toBeNull();
  });

  it("returns null when no candidate shares the kickoff minute", () => {
    const c = pickByTeamsAtMinute(target, [
      candidate({ date: "2026-06-12T02:00:00+00:00" }),
    ]);
    expect(c).toBeNull();
  });
});
