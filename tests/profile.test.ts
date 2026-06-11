import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX, parseDisplayName } from "@/lib/profile";

describe("parseDisplayName", () => {
  it("trims and keeps a normal name", () => {
    expect(parseDisplayName("  Ada Lovelace  ")).toEqual({
      ok: true,
      name: "Ada Lovelace",
    });
  });

  it("treats empty / whitespace-only as cleared (null)", () => {
    expect(parseDisplayName("   ")).toEqual({ ok: true, name: null });
    expect(parseDisplayName("")).toEqual({ ok: true, name: null });
  });

  it("treats a null FormData value as cleared (null)", () => {
    expect(parseDisplayName(null)).toEqual({ ok: true, name: null });
  });

  it("rejects names longer than the max", () => {
    const tooLong = "a".repeat(DISPLAY_NAME_MAX + 1);
    const result = parseDisplayName(tooLong);
    expect(result.ok).toBe(false);
  });

  it("accepts a name exactly at the max", () => {
    const atMax = "a".repeat(DISPLAY_NAME_MAX);
    expect(parseDisplayName(atMax)).toEqual({ ok: true, name: atMax });
  });

  it("rejects non-string, non-null input (e.g. a File)", () => {
    const result = parseDisplayName(123 as unknown);
    expect(result.ok).toBe(false);
  });
});
