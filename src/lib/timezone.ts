import "server-only";
import { headers } from "next/headers";

// Used only when Vercel's geolocation header is absent — local dev, or a proxy
// in front of the deployment. The team is Israel-based, so this is the most
// useful fallback wall-clock. Change it here if that ever stops being true.
export const DEFAULT_TIME_ZONE = "Asia/Jerusalem";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Vercel injects `x-vercel-ip-timezone` (an IANA name such as "America/Chicago")
// derived from the requester's IP on every deployment. Resolving it server-side
// lets every surface render kickoff times in the viewer's zone with no
// client-side recomputation — and no hydration mismatch.
export async function getViewerTimeZone(): Promise<string> {
  const header = (await headers()).get("x-vercel-ip-timezone");
  return header && isValidTimeZone(header) ? header : DEFAULT_TIME_ZONE;
}
