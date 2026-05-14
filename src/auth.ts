import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isAllowedEmail } from "@/lib/email-allowlist";

const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // JWT strategy so the middleware can validate the session on the edge without DB.
  session: { strategy: "jwt" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY || "dev-no-key",
      from: process.env.AUTH_EMAIL_FROM ?? "noreply@example.com",
      ...(isProd
        ? {}
        : {
            // Dev: stash the magic link on globalThis so /signin?check-email=1
            // can surface it in the browser console + as a clickable link.
            async sendVerificationRequest({
              identifier,
              url,
            }: {
              identifier: string;
              url: string;
            }) {
              const slot = globalThis as unknown as {
                __devMagicLink?: { email: string; url: string; sentAt: number };
              };
              slot.__devMagicLink = {
                email: identifier,
                url,
                sentAt: Date.now(),
              };
              // eslint-disable-next-line no-console
              console.log(`\n📨  Magic link for ${identifier}\n    ${url}\n`);
            },
          }),
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Belt-and-suspenders: refuse sign-in for any non-allowed domain even if
      // someone bypassed the /signin form (e.g., a forged magic-link request).
      const addr = user?.email ?? "";
      return isAllowedEmail(addr);
    },
    async jwt({ token, user }) {
      // On initial sign-in `user` is the DB row; persist id + isAdmin into the JWT.
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isAdmin: true },
        });
        token.isAdmin = dbUser?.isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
});
