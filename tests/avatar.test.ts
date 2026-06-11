import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  isOwnedBlobUrl,
  validateAvatarUpload,
} from "@/lib/avatar";
import { processAvatar } from "@/lib/avatar-process";

describe("validateAvatarUpload", () => {
  it("accepts allowed types within the size cap", () => {
    for (const type of AVATAR_ALLOWED_TYPES) {
      expect(validateAvatarUpload({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("rejects an empty file", () => {
    expect(validateAvatarUpload({ type: "image/png", size: 0 }).ok).toBe(false);
  });

  it("rejects a disallowed MIME type", () => {
    expect(validateAvatarUpload({ type: "image/gif", size: 1024 }).ok).toBe(false);
    expect(validateAvatarUpload({ type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validateAvatarUpload({ type: "", size: 10 }).ok).toBe(false);
  });

  it("rejects files over the size cap", () => {
    expect(
      validateAvatarUpload({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 }).ok
    ).toBe(false);
  });

  it("accepts a file exactly at the size cap", () => {
    expect(
      validateAvatarUpload({ type: "image/jpeg", size: AVATAR_MAX_BYTES })
    ).toEqual({ ok: true });
  });
});

describe("isOwnedBlobUrl", () => {
  it("recognises a Vercel Blob public URL", () => {
    expect(
      isOwnedBlobUrl(
        "https://abc123.public.blob.vercel-storage.com/avatars/u1-xyz.webp"
      )
    ).toBe(true);
  });

  it("rejects external URLs", () => {
    expect(isOwnedBlobUrl("https://lh3.googleusercontent.com/a/x=s96")).toBe(false);
    expect(isOwnedBlobUrl("https://example.com/a.png")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isOwnedBlobUrl("not a url")).toBe(false);
    expect(isOwnedBlobUrl("")).toBe(false);
  });
});

describe("processAvatar", () => {
  it("outputs a square WebP at the target size", async () => {
    const input = await sharp({
      create: {
        width: 800,
        height: 400,
        channels: 3,
        background: { r: 10, g: 120, b: 80 },
      },
    })
      .png()
      .toBuffer();

    const out = await processAvatar(input);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(AVATAR_SIZE);
    expect(meta.height).toBe(AVATAR_SIZE);
  });

  it("rejects non-image bytes (spoofed upload)", async () => {
    const notAnImage = Buffer.from("this is definitely not an image");
    await expect(processAvatar(notAnImage)).rejects.toThrow();
  });
});
