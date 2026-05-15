"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setPasswordAction,
  type SetPasswordResult,
} from "@/lib/actions/set-password";
import { PASSWORD_RULES } from "@/lib/password";

export function SetPasswordForm({ isReset }: { isReset: boolean }) {
  const [state, action, pending] = useActionState<
    SetPasswordResult | null,
    FormData
  >(setPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">
          {isReset ? "New password" : "Choose a password"}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          size="lg"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          size="lg"
        />
      </div>
      <p className="body body-size-small text-[color:var(--color-text-secondary)] flex items-center gap-1.5">
        <Lock className="size-3" /> {PASSWORD_RULES}
      </p>
      {state && !state.ok && (
        <p className="body body-size-small text-[color:var(--color-accent-danger)]">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-2" disabled={pending}>
        {pending
          ? "Saving…"
          : isReset
            ? "Update password & continue"
            : "Save password & continue"}
      </Button>
    </form>
  );
}
