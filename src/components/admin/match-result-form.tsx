"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateMatchResult, type AdminResult } from "@/lib/actions/admin";

type Match = {
  id: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
};

export function MatchResultForm({ match }: { match: Match }) {
  const [state, action, pending] = useActionState<AdminResult | null, FormData>(
    updateMatchResult,
    null
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="matchId" value={match.id} />
      <Input
        name="homeScore"
        type="number"
        min={0}
        max={20}
        defaultValue={match.homeScore ?? ""}
        placeholder="—"
        className="w-14 text-center tabular-nums"
      />
      <span className="text-[color:var(--color-text-tertiary)]">–</span>
      <Input
        name="awayScore"
        type="number"
        min={0}
        max={20}
        defaultValue={match.awayScore ?? ""}
        placeholder="—"
        className="w-14 text-center tabular-nums"
      />
      <select
        name="status"
        defaultValue={match.status}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="SCHEDULED">Scheduled</option>
        <option value="LIVE">Live</option>
        <option value="FINISHED">Finished</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state && !state.ok && (
        <span className="text-xs text-[color:var(--color-accent-danger)] ml-2">
          {state.error}
        </span>
      )}
    </form>
  );
}
