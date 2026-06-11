import { prisma } from "@/lib/prisma";
import { fetchSlackProfile, type SlackProfileInfo } from "@/lib/slack";

export type SlackSyncResult = {
  profile: SlackProfileInfo;
  /** Fields written to the DB because they differed from the stored value. */
  changed: Array<"image" | "name">;
};

/**
 * Re-fetch a user's Slack profile and update their stored name + photo when
 * either has changed.
 *
 * Slack rotates the profile image URL whenever a member changes their photo, so
 * the URL cached at first sign-in eventually points at a deleted image and
 * 404s. Calling this on each sign-in lets the cached photo self-heal.
 *
 * Only fields that differ are written. Returns the Slack profile plus which
 * fields changed, or null when no token is configured or the lookup fails.
 */
export async function syncSlackProfile(
  userId: string,
  email: string
): Promise<SlackSyncResult | null> {
  const profile = await fetchSlackProfile(email);
  if (!profile) return null;

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true, name: true },
  });

  const data: { image?: string; name?: string } = {};
  if (profile.image && profile.image !== current?.image) data.image = profile.image;
  if (profile.name && profile.name !== current?.name) data.name = profile.name;

  const changed = Object.keys(data) as Array<"image" | "name">;
  if (changed.length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }

  return { profile, changed };
}
