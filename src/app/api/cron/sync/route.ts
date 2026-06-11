import { NextResponse } from "next/server";
import { syncSquadPhotosFromFifa } from "@/lib/fifa-squad";
import { syncFromFootballData, syncVenuesFromEspn } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header !== expected) return unauthorized();

  try {
    const fd = await syncFromFootballData();
    // Venues live on a separate API (ESPN). Failures shouldn't fail the
    // whole cron — FD fixtures are the load-bearing data.
    let venues: Awaited<ReturnType<typeof syncVenuesFromEspn>> | null = null;
    let venuesError: string | null = null;
    try {
      venues = await syncVenuesFromEspn();
    } catch (err) {
      venuesError = err instanceof Error ? err.message : "unknown error";
    }
    // Squad photos come from FIFA's API and publish team-by-team over time.
    // Like venues, a failure here shouldn't fail the whole cron.
    let squadPhotos: Awaited<ReturnType<typeof syncSquadPhotosFromFifa>> | null =
      null;
    let squadPhotosError: string | null = null;
    try {
      squadPhotos = await syncSquadPhotosFromFifa();
    } catch (err) {
      squadPhotosError = err instanceof Error ? err.message : "unknown error";
    }
    return NextResponse.json({
      ok: true,
      ...fd,
      venues,
      venuesError,
      squadPhotos,
      squadPhotosError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
