"use client";

import { useActionState, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  submitPrediction,
  type SubmitResult,
} from "@/lib/actions/predictions";

const NOTE_MAX = 80;

export type PredictionFormInitial = {
  homeScore: number;
  awayScore: number;
  note?: string | null;
};

export function PredictionForm({
  matchId,
  initial,
  locked,
}: {
  matchId: string;
  initial?: PredictionFormInitial | null;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(
    submitPrediction,
    null
  );
  const [home, setHome] = useState(initial?.homeScore ?? 0);
  const [away, setAway] = useState(initial?.awayScore ?? 0);
  const [note, setNote] = useState(initial?.note ?? "");

  if (locked) {
    return (
      <div className="rounded-md border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] px-4 py-3 body body-size-medium text-[color:var(--color-text-secondary)] flex flex-col gap-2">
        {initial ? (
          <span>
            Your prediction:{" "}
            <span className="code code-size-large">
              {initial.homeScore}–{initial.awayScore}
            </span>
          </span>
        ) : (
          <span>Kickoff has passed — no prediction was submitted.</span>
        )}
        {initial?.note && (
          <span className="italic body body-size-small">
            You said: &ldquo;{initial.note}&rdquo;
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="matchId" value={matchId} />
      <div className="flex items-center justify-center gap-3">
        <ScoreSpinner
          name="homeScore"
          value={home}
          onChange={setHome}
          ariaLabel="Home team score"
        />
        <span className="heading text-2xl text-[color:var(--color-text-secondary)]">
          –
        </span>
        <ScoreSpinner
          name="awayScore"
          value={away}
          onChange={setAway}
          ariaLabel="Away team score"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`note-${matchId}`}
          className="body body-size-small text-[color:var(--color-text-secondary)]"
        >
          Hot take (optional) — locked at kickoff
        </label>
        <textarea
          id={`note-${matchId}`}
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Lock it in. Make it loud."
          className="w-full rounded-md border border-[color:var(--color-border-primary)] bg-transparent px-3 py-2 body body-size-small outline-none focus:border-[color:var(--color-border-hover)] resize-none"
        />
        <span className="self-end body body-size-xsmall text-[color:var(--color-text-tertiary)] tabular-nums">
          {note.length}/{NOTE_MAX}
        </span>
      </div>
      {state && !state.ok && (
        <p className="text-sm text-[color:var(--color-accent-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-[color:var(--color-accent-success)] flex items-center gap-1">
          <Check className="size-4" /> Saved
        </p>
      )}
      <Button type="submit" disabled={pending} size="lg" className="self-center min-w-40">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : initial ? (
          "Update prediction"
        ) : (
          "Submit prediction"
        )}
      </Button>
    </form>
  );
}

function ScoreSpinner({
  name,
  value,
  onChange,
  ariaLabel,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        className="size-8 rounded-md border border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)] text-lg"
        aria-label="Increase"
      >
        +
      </button>
      <Input
        name={name}
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
        className="w-16 text-center code code-size-large tabular-nums h-12 text-2xl"
        size="lg"
      />
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="size-8 rounded-md border border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)] text-lg"
        aria-label="Decrease"
      >
        −
      </button>
    </div>
  );
}
