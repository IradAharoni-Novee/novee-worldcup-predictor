// Retry helper for transient database errors. Neon's pooled Postgres can
// briefly refuse connections (cold start, pool pressure under load), which
// Prisma surfaces as connection errors rather than query-shape errors. One-shot
// serverless work like the daily cron has no automatic retry, so it must guard
// its own reads.

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // database server reached but timed out
  "P1008", // operations timed out
  "P1017", // server has closed the connection
  "P2024", // timed out fetching a connection from the pool
]);

const TRANSIENT_MESSAGE_HINTS = [
  "error in postgresql connection",
  "can't reach database server",
  "timed out fetching",
  "connection pool",
  "connection closed",
  "server has closed the connection",
  "econnreset",
  "etimedout",
];

/** True when an error looks like a transient connectivity blip worth retrying. */
export function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_PRISMA_CODES.has(code)) return true;
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return TRANSIENT_MESSAGE_HINTS.some((hint) => message.includes(hint));
}

export type RetryOptions = {
  /** Attempts after the first try (default 3). */
  retries?: number;
  /** Backoff base in ms; doubles each attempt (default 200). */
  baseDelayMs?: number;
  /** Decides whether a thrown error is worth retrying (default: transient DB errors). */
  shouldRetry?: (err: unknown) => boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying with exponential backoff when it throws a retryable error.
 * Non-retryable errors (and the final attempt's error) propagate unchanged.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const shouldRetry = opts.shouldRetry ?? isTransientDbError;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}
