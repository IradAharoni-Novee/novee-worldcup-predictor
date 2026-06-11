import sharp from "sharp";
import { AVATAR_SIZE } from "@/lib/avatar";

/** Downscale + normalise an uploaded image to a square WebP avatar. */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .webp()
    .toBuffer();
}
