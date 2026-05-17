import { FLAGS } from "@/lib/ctf/flags";

// Served at /.well-known/security.txt via a rewrite in next.config.ts.
// Doubles as the CTF entry breadcrumb (Acknowledgments → /ctf) and carries
// the first flag base64-encoded inside an X-Token field.
export function GET() {
  const encoded = Buffer.from(FLAGS.wellKnown.code, "utf8").toString("base64");
  const body = [
    "Contact: security@novee.security",
    "Expires: 2027-12-31T23:59:59Z",
    "Preferred-Languages: en",
    "Canonical: https://novee-worldcup-predictor.vercel.app/.well-known/security.txt",
    "Policy: https://novee.security/responsible-disclosure",
    "Acknowledgments: https://novee-worldcup-predictor.vercel.app/ctf",
    "",
    "# This site runs a small recon side-game for the team. Reachable",
    "# endpoints (auth required):",
    "#   POST /api/ctf/q       — answers carefully phrased questions",
    "#   GET  /api/ctf/status  — health check, candid when prompted",
    "#   POST /api/ctf/sieve   — verifies a guess; takes its time",
    "",
    `# X-Token: ${encoded}`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export const dynamic = "force-static";
