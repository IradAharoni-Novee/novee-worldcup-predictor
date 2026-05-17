import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/email-allowlist";
import { FLAGS } from "@/lib/ctf/flags";

// Classic timing-attack training ground. Compares the guess prefix against
// the flag character by character. For each matched character, sleeps a fixed
// amount of time. The response body is intentionally useless — it returns
// only `{ hit: boolean }`. The information about the prefix length leaks
// exclusively through wall-clock response time.
//
// Solution path (intended):
//   1. POST { guess: "v" }    → timing T0
//   2. POST { guess: "ve" }   → timing T1; if T1 > T0 + threshold, "v" was right
//   3. Repeat character by character until { hit: true }
//
// Per-character delay is generous enough to survive network jitter on a
// closed-network deploy. ~50ms per matched char × 30 chars = ~1.5s worst
// case — annoying enough to teach you to script it, not painful enough to
// time out.

const FLAG = FLAGS.timing.code;
const PER_CHAR_MS = 55;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAllowedEmail(email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { guess?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "expected application/json with a guess field" },
      { status: 400 }
    );
  }

  const guess = typeof body.guess === "string" ? body.guess : "";
  if (guess.length > 200) {
    return NextResponse.json({ error: "guess too long" }, { status: 400 });
  }

  // Walk the prefix, count matched characters, then sleep proportionally.
  let matched = 0;
  for (let i = 0; i < Math.min(guess.length, FLAG.length); i++) {
    if (guess[i] === FLAG[i]) matched += 1;
    else break;
  }
  await sleep(matched * PER_CHAR_MS);

  return NextResponse.json(
    { hit: guess === FLAG },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  return new Response(
    "POST { \"guess\": \"...\" } here. The server lies in its body and tells the truth with its clock.\n",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
