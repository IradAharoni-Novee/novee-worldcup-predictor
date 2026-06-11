import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/email-allowlist";
import { sendSlackDm } from "@/lib/slack";
import { syncSlackProfile } from "@/lib/sync-slack-profile";
import { verifyPassword } from "@/lib/password";
import { veeveeLine } from "@/lib/veevee-voice";

const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // JWT strategy so the proxy can validate the session on the edge without DB.
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // `hd` hints Google's account chooser to the Novee Workspace. It's a
      // UX hint, not a security boundary — the signIn callback enforces the
      // domain.
      authorization: {
        params: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
      },
      // Link Google sign-ins to an existing user with the same email. Safe
      // here because Google verifies emails and the allowlist restricts to a
      // single workspace domain.
      allowDangerousEmailAccountLinking: true,
    }),
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
      // First sign-in: store the user's Slack display name + photo, then DM
      // them a welcome from VeeVee. Silently no-ops if SLACK_BOT_TOKEN is unset
      // or the user isn't in the workspace.
      if (!user.id || !user.email) return;
      try {
        const result = await syncSlackProfile(user.id, user.email);
        if (!result) return;
        const slackId = result.profile.id;
        // Fire-and-forget welcome DM. Failures are silent.
        void sendSlackDm(slackId, veeveeLine("firstSignIn", slackId));
      } catch (err) {
        // Never block sign-in on a Slack lookup failure.
        // eslint-disable-next-line no-console
        console.error("Slack profile lookup failed:", err);
      }
    },
    async signIn({ user, isNewUser }) {
      // Returning sign-in: re-sync the Slack photo so a changed avatar updates
      // instead of leaving the stale (now-404ing) URL cached. createUser
      // already handles brand-new users.
      if (isNewUser || !user.id || !user.email) return;
      try {
        await syncSlackProfile(user.id, user.email);
      } catch (err) {
        // Never block sign-in on a Slack lookup failure.
        // eslint-disable-next-line no-console
        console.error("Slack profile refresh failed:", err);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Belt-and-suspenders: refuse sign-in for any non-allowed domain even if
      // someone bypassed the /signin form (e.g., a forged magic-link request).
      const addr = user?.email ?? "";
      if (!isAllowedEmail(addr)) return false;
      // For Google, also require a verified email so a malicious OAuth client
      // can't claim an unverified novee.security address.
      if (account?.provider === "google" && profile?.email_verified !== true) {
        return false;
      }
      return true;
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
