import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = [
  "/matches",
  "/bracket",
  "/leaderboard",
  "/me",
  "/admin",
  "/ctf",
  "/u",
];

// Edge-safe Auth.js config (no providers, no DB adapter, no Node-only imports).
// Used by the edge proxy (src/proxy.ts). The full config (with Prisma adapter
// + Resend provider) is in src/auth.ts.
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin?check-email=1",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/")
      );
      if (!isProtected) return true;
      if (!auth) {
        const signin = new URL("/signin", nextUrl);
        signin.searchParams.set("from", nextUrl.pathname);
        return Response.redirect(signin);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
