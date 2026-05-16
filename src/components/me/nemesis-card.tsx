"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { setNemesis, type NemesisResult } from "@/lib/actions/nemesis";
import type { LeaderboardRow } from "@/lib/leaderboard";

type Props = {
  currentUserRow: LeaderboardRow;
  nemesisRow: LeaderboardRow | null;
  candidates: LeaderboardRow[];
};

export function NemesisCard({ currentUserRow, nemesisRow, candidates }: Props) {
  const [, action, pending] = useActionState<NemesisResult | null, FormData>(
    setNemesis,
    null
  );
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>(nemesisRow?.userId ?? "");

  const showPicker = editing || !nemesisRow;

  if (showPicker) {
    return (
      <Card className="px-4 py-4 gap-3">
        <div>
          <p className="heading text-base">Your nemesis</p>
          <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Pick one teammate. VeeVee will track the gap.
          </p>
        </div>
        <form action={action} className="flex flex-col gap-2">
          <select
            name="nemesisId"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-[color:var(--color-border-primary)] bg-transparent px-3 py-2 body body-size-medium outline-none focus:border-[color:var(--color-border-hover)]"
          >
            <option value="">— No nemesis —</option>
            {candidates.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name ?? u.email.split("@")[0]} ({u.total} pts)
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Lock it in"}
            </Button>
            {nemesisRow && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    );
  }

  const delta = currentUserRow.total - (nemesisRow?.total ?? 0);
  const ahead = delta > 0;
  const tied = delta === 0;

  return (
    <Card className="px-4 py-4 gap-3">
      <div className="flex items-center justify-between">
        <p className="heading text-base">Your nemesis</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="body body-size-small text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] underline"
        >
          Change
        </button>
      </div>
      <div className="flex items-center gap-3">
        <UserAvatar
          email={nemesisRow!.email}
          name={nemesisRow!.name}
          image={nemesisRow!.image}
          size={40}
        />
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className="body body-weight-medium body-size-medium">
            {nemesisRow!.name ?? nemesisRow!.email.split("@")[0]}
          </span>
          <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
            {nemesisRow!.total} pts
          </span>
        </div>
        <div className="text-right">
          <p className="body body-size-small text-[color:var(--color-text-secondary)]">
            {tied ? "Dead level" : ahead ? "You're ahead" : "You're behind"}
          </p>
          <p
            className={
              "heading text-2xl tabular-nums " +
              (ahead
                ? "text-[color:var(--color-accent-success)]"
                : tied
                  ? ""
                  : "text-[color:var(--color-accent-danger)]")
            }
          >
            {ahead ? "+" : ""}
            {delta}
          </p>
        </div>
      </div>
    </Card>
  );
}
