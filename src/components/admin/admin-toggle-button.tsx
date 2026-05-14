"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleAdminFlag } from "@/lib/actions/admin";

export function AdminToggleButton({
  userId,
  isAdmin,
  disabled,
}: {
  userId: string;
  isAdmin: boolean;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={isAdmin ? "outline" : "default"}
      disabled={pending || disabled}
      onClick={() => start(() => void toggleAdminFlag(userId))}
    >
      {pending ? "…" : isAdmin ? "Revoke admin" : "Make admin"}
    </Button>
  );
}
