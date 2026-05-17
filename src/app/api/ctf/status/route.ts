import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/email-allowlist";
import { FLAGS } from "@/lib/ctf/flags";

// Health-check style endpoint that becomes candid when called with a magic
// request header. The `Vary` response header advertises the dependence on
// `X-Veevee-Debug`, so a careful inspector knows what to send. Accepts several
// truthy values to keep the brute-force trivial *once you spot the Vary*.
//
// The puzzle is "notice Vary, then flip the switch" — not "guess the right
// magic string under load".

const TRUTHY = new Set(["1", "true", "on", "yes", "full"]);

function authOk(email: string | null | undefined): email is string {
  return Boolean(email && isAllowedEmail(email));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !authOk(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const knob = req.headers.get("x-veevee-debug")?.trim().toLowerCase();
  const debug = knob ? TRUTHY.has(knob) : false;

  return NextResponse.json(
    debug
      ? {
          ok: true,
          uptime: Math.floor(process.uptime()),
          flag: FLAGS.debug.code,
          notes: "you flipped the switch. nice.",
        }
      : {
          ok: true,
          uptime: Math.floor(process.uptime()),
        },
    {
      headers: {
        // This is the recon breadcrumb: response varies by X-Veevee-Debug,
        // which is itself the name of the magic request header.
        Vary: "X-Veevee-Debug",
        "Cache-Control": "no-store",
      },
    }
  );
}

// HEAD returns the same headers (so curl -I surfaces Vary) without a body.
export async function HEAD(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !authOk(session.user.email)) {
    return new NextResponse(null, { status: 401 });
  }
  return new NextResponse(null, {
    headers: {
      Vary: "X-Veevee-Debug",
      "Cache-Control": "no-store",
    },
  });
}
