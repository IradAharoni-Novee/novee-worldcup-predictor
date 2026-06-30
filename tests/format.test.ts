import { describe, expect, it } from "vitest";
import { formatKickoff, isMatchLive, losingSide } from "@/lib/format";

const now = new Date("2026-06-11T19:06:00Z");
const kickedOff = new Date("2026-06-11T19:00:00Z");
const future = new Date("2026-06-12T02:00:00Z");

describe("losingSide", () => {
  const base = {
    status: "FINISHED" as const,
    homeTeamId: "home",
    awayTeamId: "away",
    advancingTeamId: null as string | null,
  };

  it("picks the lower-scored side", () => {
    expect(losingSide({ ...base, homeScore: 2, awayScore: 0 })).toBe("away");
    expect(losingSide({ ...base, homeScore: 0, awayScore: 2 })).toBe("home");
  });

  it("dims the shootout loser on a level score via the advancer", () => {
    expect(
      losingSide({ ...base, homeScore: 1, awayScore: 1, advancingTeamId: "away" })
    ).toBe("home");
    expect(
      losingSide({ ...base, homeScore: 1, awayScore: 1, advancingTeamId: "home" })
    ).toBe("away");
  });

  it("dims nobody for a level score with no advancer (group draw)", () => {
    expect(losingSide({ ...base, homeScore: 1, awayScore: 1 })).toBeNull();
  });

  it("dims nobody until the match is finished", () => {
    expect(
      losingSide({ ...base, status: "LIVE", homeScore: 2, awayScore: 0 })
    ).toBeNull();
    expect(losingSide({ ...base, homeScore: null, awayScore: null })).toBeNull();
  });
});

describe("formatKickoff", () => {
  // A single UTC instant must render in the zone it is given, independent of the
  // host runtime's own timezone — that ambient-TZ dependency was the local-time
  // display bug.
  const kickoff = new Date("2026-06-14T17:00:00Z");

  it("renders the kickoff in the given timezone", () => {
    expect(formatKickoff(kickoff, "America/Chicago")).toBe("Sun 14 Jun • 12:00");
    expect(formatKickoff(kickoff, "Asia/Jerusalem")).toBe("Sun 14 Jun • 20:00");
    expect(formatKickoff(kickoff, "UTC")).toBe("Sun 14 Jun • 17:00");
  });

  it("rolls the date over when the zone offset crosses midnight", () => {
    const lateUtc = new Date("2026-06-14T23:30:00Z");
    expect(formatKickoff(lateUtc, "Asia/Tokyo")).toBe("Mon 15 Jun • 08:30");
  });
});

describe("isMatchLive", () => {
  it("treats a kicked-off match as live even when the synced status is stale", () => {
    // The FD sync runs once a day, so a match that kicked off after the last
    // sync is still SCHEDULED in the DB. It must still count as live.
    expect(isMatchLive("SCHEDULED", kickedOff, now)).toBe(true);
  });

  it("is live when the sync has marked it LIVE", () => {
    expect(isMatchLive("LIVE", kickedOff, now)).toBe(true);
  });

  it("is not live before kickoff", () => {
    expect(isMatchLive("SCHEDULED", future, now)).toBe(false);
  });

  it("is never live once finished", () => {
    expect(isMatchLive("FINISHED", kickedOff, now)).toBe(false);
  });

  it("is live exactly at kickoff", () => {
    expect(isMatchLive("SCHEDULED", now, now)).toBe(true);
  });
});
