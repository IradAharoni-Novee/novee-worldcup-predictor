import { describe, expect, it } from "vitest";
import { isSnapshotDateParam } from "@/lib/leaderboard-snapshots";

describe("isSnapshotDateParam", () => {
  it("accepts a well-formed YYYY-MM-DD key", () => {
    expect(isSnapshotDateParam("2026-06-12")).toBe(true);
  });

  it("rejects null", () => {
    expect(isSnapshotDateParam(null)).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isSnapshotDateParam("")).toBe(false);
  });

  it("rejects malformed or partial dates", () => {
    for (const value of [
      "2026-6-12",
      "2026/06/12",
      "06-12-2026",
      "2026-06",
      "2026-06-12T00:00:00Z",
    ]) {
      expect(isSnapshotDateParam(value)).toBe(false);
    }
  });

  it("rejects trailing or leading junk", () => {
    expect(isSnapshotDateParam(" 2026-06-12")).toBe(false);
    expect(isSnapshotDateParam("2026-06-12 ")).toBe(false);
    expect(isSnapshotDateParam("2026-06-12;DROP")).toBe(false);
  });
});
