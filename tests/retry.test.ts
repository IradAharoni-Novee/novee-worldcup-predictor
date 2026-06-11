import { describe, expect, it, vi } from "vitest";
import { isTransientDbError, withRetry } from "@/lib/retry";

describe("isTransientDbError", () => {
  it("matches known transient Prisma error codes", () => {
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "P1001" }))).toBe(true);
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "P2024" }))).toBe(true);
  });

  it("matches transient connection messages regardless of code", () => {
    expect(isTransientDbError(new Error("Error in PostgreSQL connection: closed"))).toBe(true);
    expect(isTransientDbError(new Error("Can't reach database server at db:5432"))).toBe(true);
    expect(
      isTransientDbError(new Error("Timed out fetching a new connection from the pool"))
    ).toBe(true);
  });

  it("matches the exact prod error that broke the deadline-reminders cron", () => {
    // Verbatim from Vercel runtime logs, 2026-06-11.
    const err = new Error(
      "Invalid `prisma.setting.findUnique()` invocation:\n\n" +
        "Can't reach database server at " +
        "`ep-dark-heart-al6ddynk-pooler.c-3.eu-central-1.aws.neon.tech:5432`"
    );
    expect(isTransientDbError(err)).toBe(true);
  });

  it("does not match query-shape or unknown errors", () => {
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "P2002" }))).toBe(false);
    expect(isTransientDbError(new Error("Invalid value for argument"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the result without retrying on success", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and then succeeds", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Error in PostgreSQL connection"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Invalid value for argument");
    });
    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toThrow("Invalid value");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries and throws the last error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Can't reach database server");
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 0 })).rejects.toThrow(
      "Can't reach database server"
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
