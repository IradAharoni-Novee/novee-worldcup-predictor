"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  triggerSquadSync,
  triggerSync,
  type AdminResult,
} from "@/lib/actions/admin";

export function SyncButton() {
  const [matchesPending, startMatches] = useTransition();
  const [squadsPending, startSquads] = useTransition();
  const [result, setResult] = useState<AdminResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          disabled={matchesPending}
          onClick={() =>
            startMatches(async () => {
              const r = await triggerSync();
              setResult(r);
            })
          }
        >
          {matchesPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Syncing fixtures…
            </>
          ) : (
            "Sync fixtures & results"
          )}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={squadsPending}
          onClick={() =>
            startSquads(async () => {
              const r = await triggerSquadSync();
              setResult(r);
            })
          }
        >
          {squadsPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Syncing squads…
            </>
          ) : (
            "Sync player squads"
          )}
        </Button>
      </div>
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
