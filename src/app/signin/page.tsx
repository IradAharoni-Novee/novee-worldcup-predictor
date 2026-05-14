import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VeeVeeLogo } from "@/components/ui/novee-logo";
import {
  ALLOWED_EMAIL_DOMAIN,
  ALLOWED_EMAIL_MESSAGE,
  isAllowedEmail,
} from "@/lib/email-allowlist";

const isDev = process.env.NODE_ENV !== "production";

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
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params["check-email"] === "1";
  const from = params.from ?? "/matches";
  const devLink = checkEmail ? getDevMagicLink() : null;
  const errorMessage =
    params.error === "domain"
      ? ALLOWED_EMAIL_MESSAGE
      : params.error === "send"
        ? "Could not send the magic link. Try again in a moment."
        : null;

  async function emailSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      redirect("/signin?error=domain");
    }
    try {
      await signIn("resend", { email, redirectTo: from });
    } catch (err) {
      // signIn throws a redirect error on success — re-throw to let Next handle it.
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      redirect("/signin?error=send");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <VeeVeeLogo size={36} />
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
                Check your inbox. The link is good for 24 hours.
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
          ) : (
            <form action={emailSignIn} className="flex flex-col gap-3">
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
                  title={`Must be a @${ALLOWED_EMAIL_DOMAIN} email`}
                  size="lg"
                />
              </div>
              {errorMessage && (
                <p className="body body-size-small text-[color:var(--color-accent-danger)]">
                  {errorMessage}
                </p>
              )}
              <Button type="submit" size="lg" className="mt-2">
                Email me a link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
