"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSync, type AdminResult } from "@/lib/actions/admin";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await triggerSync();
            setResult(r);
          })
        }
        className="self-start"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Syncing…
          </>
        ) : (
          "Sync from football-data.org now"
        )}
      </Button>
      {result?.ok && (
        <p className="body body-size-small text-[color:var(--color-accent-success)]">
          Sync complete.
        </p>
      )}
      {result && !result.ok && (
        <p className="body body-size-small text-[color:var(--color-accent-danger)]">
          {result.error}
        </p>
      )}
    </div>
  );
}
