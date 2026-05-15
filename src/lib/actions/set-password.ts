"use server";

import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";

export type SetPasswordResult = { ok: false; error: string };

export async function setPasswordAction(
  _prev: SetPasswordResult | null,
  formData: FormData
): Promise<SetPasswordResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "You must be signed in to set a password." };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }
  const err = validatePassword(password);
  if (err) return { ok: false, error: err };

  const hash = await hashPassword(password);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash },
  });

  // Sign the user in with credentials so the new JWT reflects the password flow,
  // then send them to the app.
  await signIn("credentials", {
    email: session.user.email,
    password,
    redirectTo: "/matches",
  });
  // signIn redirects on success; this is unreachable.
  redirect("/matches");
}
