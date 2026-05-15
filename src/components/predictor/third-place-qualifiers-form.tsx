"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { submitThirdPlaceQualifiers } from "@/lib/actions/third-place-qualifiers";
import { MAX_THIRD_PLACE_QUALIFIERS as MAX_QUALIFIERS } from "@/lib/third-place-qualifiers";

export type Candidate = {
  teamId: string;
  teamName: string;
  teamFlag: string | null;
  group: string;
};

function serializeSet(set: Set<string>): string {
  return [...set].sort().join("|");
}

function SaveBadge({
  pending,
  status,
}: {
  pending: boolean;
  status: "idle" | "saved" | { error: string };
}) {
  if (pending) {
    return (
      <span className="body body-size-small text-[color:var(--color-text-secondary)] flex items-center gap-1">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="body body-size-small text-[color:var(--color-accent-success)] flex items-center gap-1">
        <Check className="size-3.5" /> Saved
      </span>
    );
  }
  if (typeof status === "object") {
    return (
      <span className="body body-size-small text-[color:var(--color-accent-danger)]">
        {status.error}
      </span>
    );
  }
  return null;
}

export function ThirdPlaceQualifiersForm({
  candidates,
  initialTeamIds,
  locked,
}: {
  candidates: Candidate[];
  initialTeamIds: string[];
  locked: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialTeamIds)
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | { error: string }>(
    "idle"
  );
  const lastSavedRef = useRef<string>(serializeSet(new Set(initialTeamIds)));

  useEffect(() => {
    const snapshot = serializeSet(selected);
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("teamIds", JSON.stringify([...selected]));
        const result = await submitThirdPlaceQualifiers(null, fd);
        if (result.ok) {
          lastSavedRef.current = snapshot;
          setStatus("saved");
        } else {
          setStatus({ error: result.error });
        }
      });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function toggle(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else if (next.size < MAX_QUALIFIERS) {
        next.add(teamId);
      }
      return next;
    });
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
          Locked — all groups have kicked off.
        </p>
        <ul className="grid gap-1 md:grid-cols-2 lg:grid-cols-4">
          {candidates
            .filter((c) => selected.has(c.teamId))
            .map((c) => (
              <li
                key={c.teamId}
                className="flex items-center gap-2 rounded-md border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] px-3 py-2"
              >
                {c.teamFlag && (
                  <img
                    src={c.teamFlag}
                    alt=""
                    className="w-6 h-4 rounded-sm object-cover shrink-0"
                  />
                )}
                <span className="body body-size-small body-weight-medium truncate">
                  {c.teamName}
                </span>
                <Chip size="small" color="slate" label={c.group} className="ml-auto" />
              </li>
            ))}
        </ul>
      </div>
    );
  }

  const remaining = MAX_QUALIFIERS - selected.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="body body-size-small text-[color:var(--color-text-secondary)]">
          Of the 12 group-third-placed teams, the best 8 advance to R32. Pick
          the {MAX_QUALIFIERS} you think qualify.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <SaveBadge pending={pending} status={status} />
          <Chip
            size="small"
            color={selected.size === MAX_QUALIFIERS ? "green" : "amber"}
            label={`${selected.size}/${MAX_QUALIFIERS}`}
          />
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {candidates.map((c) => {
          const isSelected = selected.has(c.teamId);
          const disabled = !isSelected && remaining === 0;
          return (
            <button
              key={c.teamId}
              type="button"
              onClick={() => toggle(c.teamId)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors " +
                (isSelected
                  ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10"
                  : disabled
                    ? "border-[color:var(--color-border-secondary)] text-[color:var(--color-text-tertiary)] cursor-not-allowed"
                    : "border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)]")
              }
            >
              {c.teamFlag && (
                <img
                  src={c.teamFlag}
                  alt=""
                  className="w-6 h-4 rounded-sm object-cover shrink-0"
                />
              )}
              <span className="body body-size-small body-weight-medium truncate flex-1">
                {c.teamName}
              </span>
              <span className="code code-size-small text-[color:var(--color-text-tertiary)]">
                3rd {c.group}
              </span>
              {isSelected && (
                <Check className="size-4 text-[color:var(--color-accent-success)] shrink-0" />
              )}
            </button>
          );
        })}
        {candidates.length === 0 && (
          <p className="col-span-full body body-size-small text-[color:var(--color-text-tertiary)] py-4 text-center">
            Predict your group standings to see candidate third-place teams here.
          </p>
        )}
      </div>
    </div>
  );
}
