import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isAllowedEmail } from "@/lib/email-allowlist";
import { fetchSlackProfile, sendSlackDm } from "@/lib/slack";
import { verifyPassword } from "@/lib/password";
import { veeveeLine } from "@/lib/veevee-voice";

const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // JWT strategy so the proxy can validate the session on the edge without DB.
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (!isAllowedEmail(email)) return null;
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
          },
        });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
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
  events: {
    async createUser({ user }) {
      // First sign-in: look up the user in Slack and store their display name + photo,
      // then DM them a welcome from VeeVee. Silently no-ops if SLACK_BOT_TOKEN is
      // unset or the user isn't in the workspace.
      if (!user.id || !user.email) return;
      try {
        const profile = await fetchSlackProfile(user.email);
        if (!profile) return;
        const data: { image?: string; name?: string } = {};
        if (profile.image) data.image = profile.image;
        if (profile.name) data.name = profile.name;
        if (Object.keys(data).length > 0) {
          await prisma.user.update({ where: { id: user.id }, data });
        }
        // Fire-and-forget welcome DM. Failures are silent.
        void sendSlackDm(profile.id, veeveeLine("firstSignIn", profile.id));
      } catch (err) {
        // Never block sign-in on a Slack lookup failure.
        // eslint-disable-next-line no-console
        console.error("Slack profile lookup failed:", err);
      }
    },
  },
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
