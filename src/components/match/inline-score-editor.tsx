"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { submitPrediction } from "@/lib/actions/predictions";

type Initial = { homeScore: number; awayScore: number } | null;

export function InlineScoreEditor({
  matchId,
  initial,
}: {
  matchId: string;
  initial: Initial;
}) {
  const initialHome = initial?.homeScore ?? null;
  const initialAway = initial?.awayScore ?? null;
  const [home, setHome] = useState(initialHome ?? 0);
  const [away, setAway] = useState(initialAway ?? 0);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "saved" | { error: string }
  >("idle");
  // Track the (homeScore, awayScore) pair the server already has. Null means
  // the user hasn't submitted yet — first real change always triggers a save.
  const lastSavedRef = useRef<readonly [number | null, number | null]>([
    initialHome,
    initialAway,
  ]);

  useEffect(() => {
    if (lastSavedRef.current[0] === home && lastSavedRef.current[1] === away) {
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("homeScore", String(home));
        fd.set("awayScore", String(away));
        const result = await submitPrediction(null, fd);
        if (result.ok) {
          lastSavedRef.current = [home, away];
          setStatus("saved");
        } else {
          setStatus({ error: result.error });
        }
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Stepper
        value={home}
        onChange={setHome}
        ariaLabel="Home team score"
      />
      <span
        className="body body-size-small text-[color:var(--color-text-tertiary)]"
        aria-hidden
      >
        –
      </span>
      <Stepper
        value={away}
        onChange={setAway}
        ariaLabel="Away team score"
      />
      <SaveBadge pending={pending} status={status} initial={initial !== null} />
    </div>
  );
}

function SaveBadge({
  pending,
  status,
  initial,
}: {
  pending: boolean;
  status: "idle" | "saved" | { error: string };
  initial: boolean;
}) {
  if (pending) {
    return (
      <span className="ml-auto body body-size-small text-[color:var(--color-text-secondary)] flex items-center gap-1">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="ml-auto body body-size-small text-[color:var(--color-accent-success)] flex items-center gap-1">
        <Check className="size-3.5" /> Saved
      </span>
    );
  }
  if (typeof status === "object") {
    return (
      <span className="ml-auto body body-size-small text-[color:var(--color-accent-danger)]">
        {status.error}
      </span>
    );
  }
  return (
    <span className="ml-auto body body-size-small text-[color:var(--color-text-tertiary)]">
      {initial ? "Your pick" : "Saves on change"}
    </span>
  );
}

function Stepper({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex items-stretch h-7 rounded-md border border-[color:var(--color-border-primary)] overflow-hidden"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease"
        className="w-7 hover:bg-[color:var(--color-surface-hover)] body body-size-small text-[color:var(--color-text-secondary)]"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(0, Math.min(20, Math.floor(n))));
        }}
        className="w-10 text-center code code-size-medium tabular-nums bg-transparent border-x border-[color:var(--color-border-secondary)] outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        aria-label="Increase"
        className="w-7 hover:bg-[color:var(--color-surface-hover)] body body-size-small text-[color:var(--color-text-secondary)]"
      >
        +
      </button>
    </div>
  );
}
