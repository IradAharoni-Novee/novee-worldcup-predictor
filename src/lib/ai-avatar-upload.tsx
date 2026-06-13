import { readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { ImageResponse } from "next/og";
import { AI_PLAYER_EMAILS } from "@/lib/ai-players";

// Brand-mark source SVGs (under public/avatars) for each seeded AI player.
// Rendered to PNG and uploaded to Vercel Blob so the players carry a real
// User.image and are treated like any other user everywhere downstream.
const AI_AVATAR_SVGS: Record<string, string> = {
  [AI_PLAYER_EMAILS.opus]: "anthropic.svg",
  [AI_PLAYER_EMAILS.gpt]: "openai.svg",
  [AI_PLAYER_EMAILS.gemini]: "gemini.svg",
  [AI_PLAYER_EMAILS.cousin]: "cousin.svg",
};

// The brand marks display at ≤68px; 512 keeps them crisp on retina avatars.
const SIZE = 512;

/** Emails that have a brand-mark avatar to render. */
export const AI_AVATAR_EMAILS: readonly string[] = Object.keys(AI_AVATAR_SVGS);

async function renderPng(svgFile: string): Promise<Buffer> {
  const svg = await readFile(
    path.join(process.cwd(), "public", "avatars", svgFile)
  );
  // The brand SVGs carry their own colored circular background, so rasterising
  // them preserves each player's correct colors. next/og (Satori + resvg) is
  // already a dependency via next, so no separate rasteriser is needed.
  const png = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <img
          src={`data:image/svg+xml;base64,${svg.toString("base64")}`}
          alt=""
          width={SIZE}
          height={SIZE}
        />
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
  return Buffer.from(await png.arrayBuffer());
}

/**
 * Render a seeded AI player's brand mark to a PNG and upload it to Vercel Blob.
 *
 * The blob path is derived from the email local-part with a fixed suffix, so
 * re-running overwrites the same object and the stored URL stays stable.
 *
 * @param email One of the seeded AI player emails.
 * @returns The public Blob URL to store as the player's `User.image`.
 */
export async function renderAndUploadAiAvatar(email: string): Promise<string> {
  const svgFile = AI_AVATAR_SVGS[email];
  if (!svgFile) {
    throw new Error(`No brand-mark avatar is mapped for "${email}".`);
  }
  const png = await renderPng(svgFile);
  const localPart = email.split("@")[0] || email;
  const blob = await put(`ai-avatars/${localPart}.png`, png, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
