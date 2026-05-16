import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorldCupLogo } from "@/components/ui/novee-logo";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function SetPasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true, name: true },
  });
  if (!me) redirect("/signin");

  const isReset = Boolean(me.passwordHash);

  return (
    <main className="min-h-screen grid place-items-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <WorldCupLogo size={40} priority />
            <div className="flex flex-col gap-0.5">
              <CardTitle>
                {isReset ? "Reset your password" : "Set a password"}
              </CardTitle>
              <CardDescription>
                {isReset
                  ? "Pick a new password. You'll use it to sign in from now on."
                  : `Welcome${me.name ? `, ${me.name}` : ""}. Pick a password — you'll use it to sign in from now on.`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SetPasswordForm isReset={isReset} />
        </CardContent>
      </Card>
    </main>
  );
}
