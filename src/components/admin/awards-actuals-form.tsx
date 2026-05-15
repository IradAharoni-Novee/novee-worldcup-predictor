"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setActualAwards,
  type AwardSubmitResult,
} from "@/lib/actions/awards";

type Team = { id: string; name: string };

type Player = {
  id: string;
  name: string;
  teamName: string | null;
};

export function AwardsActualsForm({
  teams,
  players,
  initialWinnerTeamId,
  initialGoldenBootPlayerId,
}: {
  teams: Team[];
  players: Player[];
  initialWinnerTeamId: string | null;
  initialGoldenBootPlayerId: string | null;
}) {
  const [state, action, pending] = useActionState<AwardSubmitResult | null, FormData>(
    setActualAwards,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="body body-weight-medium body-size-small">
          Actual tournament winner
        </label>
        <select
          name="actualWinnerTeamId"
          defaultValue={initialWinnerTeamId ?? ""}
          className="rounded-md border border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] px-3 py-2 body body-size-medium"
        >
          <option value="">— Not decided yet —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="body body-weight-medium body-size-small">
          Actual golden-boot winner
        </label>
        <select
          name="actualGoldenBootPlayerId"
          defaultValue={initialGoldenBootPlayerId ?? ""}
          className="rounded-md border border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] px-3 py-2 body body-size-medium"
        >
          <option value="">— Not decided yet —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.teamName ? ` (${p.teamName})` : ""}
            </option>
          ))}
        </select>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-[color:var(--color-accent-danger)]">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-[color:var(--color-accent-success)] flex items-center gap-1">
          <Check className="size-4" /> Saved
        </p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save actuals"
        )}
      </Button>
    </form>
  );
}
