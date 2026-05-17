import type { NextConfig } from "next";
import { FLAGS } from "./src/lib/ctf/flags";

// Build a JWT-like token (alg:none) whose payload base64url-decodes to a JSON
// blob containing the recon flag. Set as a non-HttpOnly cookie on the landing
// page so anyone inspecting DevTools → Application → Cookies can find it. The
// "first lesson" is that JWTs aren't encrypted, just base64-encoded.
function buildJwtCookieValue(flagCode: string): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = enc({ alg: "none", typ: "VEE" });
  const payload = enc({ sub: "recon", iss: "veevee", flag: flagCode });
  // Signature is intentionally bogus — alg:none doesn't need one.
  const signature = Buffer.from("not-a-real-signature", "utf8").toString(
    "base64url"
  );
  return `${header}.${payload}.${signature}`;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crests.football-data.org",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
    ],
  },
  async headers() {
    const jwt = buildJwtCookieValue(FLAGS.jwt.code);
    return [
      {
        source: "/",
        headers: [
          // Recon: a JWT-like cookie. Not HttpOnly so it's visible in DevTools.
          {
            key: "Set-Cookie",
            value: `veevee-recon=${jwt}; Path=/; SameSite=Lax; Max-Age=86400`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Map the canonical security.txt URL to a normal route segment.
      {
        source: "/.well-known/security.txt",
        destination: "/api/ctf/well-known",
      },
    ];
  },
};

export default nextConfig;
