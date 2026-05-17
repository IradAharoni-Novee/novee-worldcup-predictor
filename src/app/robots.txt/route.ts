// Plain robots.txt — no breadcrumbs, no flags. The CTF entry path lives in
// /.well-known/security.txt instead, which is the more authentic recon trail.
export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /set-password",
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
