import { describe, expect, it } from "vitest";
import { isMatchLive } from "@/lib/format";

const now = new Date("2026-06-11T19:06:00Z");
const kickedOff = new Date("2026-06-11T19:00:00Z");
const future = new Date("2026-06-12T02:00:00Z");

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
