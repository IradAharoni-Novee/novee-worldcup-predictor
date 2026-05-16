import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorldCupLogo } from "@/components/ui/novee-logo";
import {
  ALLOWED_EMAIL_DOMAIN,
  ALLOWED_EMAIL_MESSAGE,
  isAllowedEmail,
} from "@/lib/email-allowlist";

const isDev = process.env.NODE_ENV !== "production";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function getDevMagicLink() {
  if (!isDev) return null;
  const slot = globalThis as unknown as {
    __devMagicLink?: { email: string; url: string; sentAt: number };
  };
  const link = slot.__devMagicLink;
  if (!link) return null;
  if (Date.now() - link.sentAt > 10 * 60 * 1000) return null;
  return link;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    "check-email"?: string;
    from?: string;
    error?: string;
    mode?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params["check-email"] === "1";
  const from = params.from ?? "/matches";
  const mode = params.mode === "link" ? "link" : "password";
  const devLink = checkEmail ? getDevMagicLink() : null;

  const errorMessage =
    params.error === "domain"
      ? ALLOWED_EMAIL_MESSAGE
      : params.error === "credentials"
        ? "Wrong email or password. Use “Get a one-time link” below if you need to set or reset a password."
        : params.error === "send"
          ? "Could not send the link. Try again in a moment."
          : params.error === "CredentialsSignin"
            ? "Wrong email or password."
            : params.error === "google"
              ? "Google sign-in failed. Try again or use email."
              : params.error === "AccessDenied"
                ? ALLOWED_EMAIL_MESSAGE
                : null;

  // --- server actions ---

  async function passwordSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!isAllowedEmail(email)) {
      redirect("/signin?error=domain");
    }
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: from,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      redirect("/signin?error=credentials");
    }
  }

  async function googleSignInAction() {
    "use server";
    try {
      await signIn("google", { redirectTo: from });
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      redirect("/signin?error=google");
    }
  }

  async function magicLinkSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      redirect("/signin?mode=link&error=domain");
    }
    try {
      // Magic link is invitation + forgot-password only. Always land on
      // /set-password so the user must (re)set their password before
      // continuing to the app.
      await signIn("resend", { email, redirectTo: "/set-password" });
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      redirect("/signin?mode=link&error=send");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <WorldCupLogo size={40} priority />
            <div className="flex flex-col gap-0.5">
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Novee employees only — use your @{ALLOWED_EMAIL_DOMAIN} address.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {checkEmail ? (
            <div className="flex flex-col gap-3">
              <p className="body body-size-medium text-[color:var(--color-text-secondary)]">
                Check your inbox. The link is good for 24 hours and lets you set or
                reset your password.
              </p>
              {devLink && (
                <>
                  <div className="rounded-md border border-[color:var(--color-category-border-amber)] bg-[color:var(--color-category-bg-amber)] p-3 flex flex-col gap-2">
                    <p className="body body-size-small body-weight-medium text-[color:var(--color-category-surface-amber)]">
                      Dev mode — no real email was sent. Magic link below.
                    </p>
                    <p className="body body-size-small text-[color:var(--color-text-secondary)] break-all">
                      <code className="code code-size-small">{devLink.email}</code>
                    </p>
                    <Button asChild size="sm" variant="default">
                      <a href={devLink.url}>Open magic link →</a>
                    </Button>
                  </div>
                  <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
                    The link was also printed to your browser console.
                  </p>
                  <script
                    dangerouslySetInnerHTML={{
                      __html: `console.log("%c📨 Magic link for " + ${JSON.stringify(devLink.email)} + ":", "color:#8e55fd;font-weight:bold");console.log(${JSON.stringify(devLink.url)});`,
                    }}
                  />
                </>
              )}
            </div>
          ) : mode === "link" ? (
            <div className="flex flex-col gap-3">
              <form action={googleSignInAction}>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  <GoogleMark />
                  Continue with Google
                </Button>
              </form>
              <div className="relative my-1 flex items-center">
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
                <span className="px-3 body body-size-small text-[color:var(--color-text-tertiary)]">
                  or
                </span>
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
              </div>
              <form action={magicLinkSignIn} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
                  pattern={`[a-zA-Z0-9._%+\\-]+@${ALLOWED_EMAIL_DOMAIN.replace(/\./g, "\\.")}`}
                  size="lg"
                />
              </div>
              {errorMessage && (
                <p className="body body-size-small text-[color:var(--color-accent-danger)]">
                  {errorMessage}
                </p>
              )}
              <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                We&apos;ll email you a link to set or reset your password. The
                link is one-time use and good for 24 hours.
              </p>
              <Button type="submit" size="lg">
                Email me a link
              </Button>
              <p className="body body-size-small text-[color:var(--color-text-tertiary)] text-center">
                <a
                  href="/signin"
                  className="underline hover:text-[color:var(--color-text-primary)]"
                >
                  Back to password sign-in
                </a>
              </p>
            </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <form action={googleSignInAction}>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  <GoogleMark />
                  Continue with Google
                </Button>
              </form>
              <div className="relative my-1 flex items-center">
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
                <span className="px-3 body body-size-small text-[color:var(--color-text-tertiary)]">
                  or
                </span>
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
              </div>
              <form action={passwordSignIn} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
                  pattern={`[a-zA-Z0-9._%+\\-]+@${ALLOWED_EMAIL_DOMAIN.replace(/\./g, "\\.")}`}
                  size="lg"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  size="lg"
                />
              </div>
              {errorMessage && (
                <p className="body body-size-small text-[color:var(--color-accent-danger)]">
                  {errorMessage}
                </p>
              )}
              <Button type="submit" size="lg">
                Sign in
              </Button>
              <div className="relative my-1 flex items-center">
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
                <span className="px-3 body body-size-small text-[color:var(--color-text-tertiary)]">
                  or
                </span>
                <div className="flex-1 border-t border-[color:var(--color-border-secondary)]" />
              </div>
              <Button asChild variant="outline" size="lg">
                <a href="/signin?mode=link">First time or forgot password?</a>
              </Button>
              <p className="body body-size-small text-[color:var(--color-text-tertiary)] text-center">
                We&apos;ll email you a one-time link to set or reset your password.
              </p>
            </form>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
