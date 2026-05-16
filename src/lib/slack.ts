// Slack profile lookup. Used at first sign-in to populate User.image.
// Requires a Slack bot token with the `users:read` + `users:read.email` scopes.

const SLACK_API = "https://slack.com/api";

type SlackProfile = {
  real_name?: string;
  display_name?: string;
  real_name_normalized?: string;
  display_name_normalized?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  image_1024?: string;
  image_original?: string;
  is_custom_image?: boolean;
};

export type SlackProfileInfo = {
  id: string;
  image: string | null;
  name: string | null;
};

type LookupResponse =
  | { ok: true; user: { id: string; profile: SlackProfile } }
  | { ok: false; error: string };

async function lookupOnce(
  email: string,
  token: string
): Promise<SlackProfileInfo | null> {
  let res: Response;
  try {
    res = await fetch(
      `${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as LookupResponse;
  if (!data.ok) return null;

  const profile = data.user.profile;
  const customImage = profile.is_custom_image !== false;
  const image = customImage
    ? profile.image_512 ?? profile.image_192 ?? profile.image_72 ?? null
    : null;

  // Prefer display_name when the user set one, otherwise real_name.
  const display = profile.display_name?.trim();
  const real = profile.real_name?.trim();
  const name = display && display.length > 0 ? display : real && real.length > 0 ? real : null;

  return { id: data.user.id, image, name };
}

/**
 * Send a DM to a Slack user. Silently returns false when no token is
 * configured or the call fails. Never throws — callers can fire-and-forget.
 */
export async function sendSlackDm(
  slackUserId: string,
  text: string
): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: slackUserId, text }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

function fallbackEmails(email: string): string[] {
  const raw = process.env.SLACK_EMAIL_DOMAINS;
  if (!raw) return [];
  const localPart = email.split("@")[0];
  if (!localPart) return [];
  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((domain) => `${localPart}@${domain}`)
    .filter((e) => e.toLowerCase() !== email.toLowerCase());
}

/**
 * Fetch Slack profile info (display name + photo URL) for the given email.
 * Returns null when no token is configured, the user isn't in the workspace,
 * or the request fails. If SLACK_EMAIL_DOMAINS is set, also tries the local-part
 * paired with each of those domains.
 */
export async function fetchSlackProfile(email: string): Promise<SlackProfileInfo | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  const direct = await lookupOnce(email, token);
  if (direct) return direct;

  for (const alt of fallbackEmails(email)) {
    const result = await lookupOnce(alt, token);
    if (result) return result;
  }
  return null;
}
