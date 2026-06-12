import { describe, expect, it } from "vitest";
import { resolveAwardsLockTime } from "@/lib/locks";

const T = (iso: string) => new Date(iso);

describe("resolveAwardsLockTime", () => {
  const tournamentLock = T("2026-06-11T19:00:00Z");

  it("uses a valid ISO override string in place of the tournament lock", () => {
    const result = resolveAwardsLockTime("2026-06-12T19:00:00Z", tournamentLock);
    expect(result?.toISOString()).toBe("2026-06-12T19:00:00.000Z");
  });

  it("falls back to the tournament lock when no override is set", () => {
    expect(resolveAwardsLockTime(undefined, tournamentLock)).toBe(tournamentLock);
    expect(resolveAwardsLockTime(null, tournamentLock)).toBe(tournamentLock);
  });

  it("falls back to the tournament lock when the override is not a valid date", () => {
    expect(resolveAwardsLockTime("not-a-date", tournamentLock)).toBe(tournamentLock);
    expect(resolveAwardsLockTime(1750100400, tournamentLock)).toBe(tournamentLock);
    expect(resolveAwardsLockTime({}, tournamentLock)).toBe(tournamentLock);
  });

  it("returns null when neither an override nor a tournament lock exists", () => {
    expect(resolveAwardsLockTime(undefined, null)).toBeNull();
    expect(resolveAwardsLockTime("bad", null)).toBeNull();
  });

  it("honors an override even when there is no tournament lock", () => {
    const result = resolveAwardsLockTime("2026-06-12T19:00:00Z", null);
    expect(result?.toISOString()).toBe("2026-06-12T19:00:00.000Z");
  });
});
