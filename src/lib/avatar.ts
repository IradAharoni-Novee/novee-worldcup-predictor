export const AVATAR_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const AVATAR_SIZE = 256;
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarValidation = { ok: true } | { ok: false; error: string };

/** Validate an upload's MIME type + byte size. Server is the source of truth. */
export function validateAvatarUpload(file: {
  type: string;
  size: number;
}): AvatarValidation {
  if (file.size <= 0) {
    return { ok: false, error: "No image selected." };
  }
  if (
    !AVATAR_ALLOWED_TYPES.includes(
      file.type as (typeof AVATAR_ALLOWED_TYPES)[number]
    )
  ) {
    return { ok: false, error: "Upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Image must be 4 MB or smaller." };
  }
  return { ok: true };
}

/**
 * Whether a stored image URL points at our own Vercel Blob store. Used to
 * safely delete superseded avatars without touching external URLs (e.g. an
 * OAuth provider avatar, or a previously imported photo).
 */
export function isOwnedBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
