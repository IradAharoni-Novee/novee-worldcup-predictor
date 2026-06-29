"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Flame, Loader2 } from "lucide-react";
import { submitPrediction } from "@/lib/actions/predictions";
import { veeveeLine } from "@/lib/veevee-voice";
import { veeveeToast } from "@/components/ui/veevee-toast";
import { TeamRow, type TeamLite } from "@/components/match/team-row";
import { SubmissionDeadline } from "@/components/predictor/submission-deadline";

const NOTE_MAX = 80;

type Initial = {
  homeScore: number;
  awayScore: number;
  shootoutWinnerTeamId?: string | null;
  note?: string | null;
} | null;

// Iconic World Cup scores. Typing one flashes a small label for ~1s.
// Easter egg — no UI affordance, no impact on prediction logic.
const HISTORIC_SCORES: Record<string, string> = {
  "7-1": "📜 Mineirazo · GER 7–1 BRA, 2014",
  "1-7": "📜 Mineirazo · GER 7–1 BRA, 2014",
  "4-2": "📜 1966 final · ENG 4–2 GER",
  "3-3": "📜 POR 3–3 ESP, 2018 (Ronaldo hat-trick)",
};

export function InlineScoreEditor({
  matchId,
  initial,
  homeTeam,
  awayTeam,
  homeFallback,
  awayFallback,
  deadline,
  knockout,
  homeTeamId,
  awayTeamId,
}: {
  matchId: string;
  initial: Initial;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  homeFallback?: string;
  awayFallback?: string;
  deadline: Date;
  knockout: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
}) {
  const initialHome = initial?.homeScore ?? 0;
  const initialAway = initial?.awayScore ?? 0;
  const initialNote = initial?.note ?? "";
  const initialShootout = initial?.shootoutWinnerTeamId ?? "";
  const [home, setHome] = useState(initialHome);
  const [away, setAway] = useState(initialAway);
  const [note, setNote] = useState(initialNote);
  const [shootout, setShootout] = useState<string | null>(
    initial?.shootoutWinnerTeamId ?? null
  );
  const [pending, startTransition] = useTransition();

  // A shootout winner only matters for a knockout predicted level with known
  // teams. `currentShootout` is what we persist — empty unless that holds.
  const showShootout =
    knockout && home === away && homeTeamId != null && awayTeamId != null;
  const currentShootout = showShootout ? shootout ?? "" : "";
  const [status, setStatus] = useState<
    "idle" | "saved" | { error: string }
  >("idle");
  const [historicGlyph, setHistoricGlyph] = useState<string | null>(null);
  // Track the (homeScore, awayScore, note, shootoutWinnerTeamId) the server
  // already has. Seeded to the displayed values so the initial mount is a no-op
  // — only real user edits trigger a save.
  const lastSavedRef = useRef<readonly [number, number, string, string]>([
    initialHome,
    initialAway,
    initialNote,
    initialShootout,
  ]);
  // Toast only on the first save per editor mount, so the auto-save on every
  // stepper click doesn't spam VeeVee.
  const hasToastedRef = useRef(false);

  useEffect(() => {
    const key = `${home}-${away}`;
    const match = HISTORIC_SCORES[key];
    if (!match) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show glyph, faded out by the timeout below
    setHistoricGlyph(match);
    const fade = setTimeout(() => setHistoricGlyph(null), 4000);
    return () => clearTimeout(fade);
  }, [home, away]);

  useEffect(() => {
    const [savedHome, savedAway, savedNote, savedShootout] = lastSavedRef.current;
    if (
      savedHome === home &&
      savedAway === away &&
      savedNote === note &&
      savedShootout === currentShootout
    ) {
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("homeScore", String(home));
        fd.set("awayScore", String(away));
        fd.set("shootoutWinnerTeamId", currentShootout);
        fd.set("note", note);
        const result = await submitPrediction(null, fd);
        if (result.ok) {
          lastSavedRef.current = [home, away, note, currentShootout];
          setStatus("saved");
          if (!hasToastedRef.current) {
            hasToastedRef.current = true;
            veeveeToast(veeveeLine("saveToast", matchId));
          }
        } else {
          setStatus({ error: result.error });
        }
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, note, currentShootout]);

  return (
    <div className="px-4 flex flex-col gap-2.5">
      <div className="flex flex-col gap-2">
        <TeamRow
          team={homeTeam}
          fallback={homeFallback}
          right={
            <Stepper
              value={home}
              onChange={setHome}
              ariaLabel={`${homeTeam?.name ?? "Home"} score`}
            />
          }
        />
        <TeamRow
          team={awayTeam}
          fallback={awayFallback}
          right={
            <Stepper
              value={away}
              onChange={setAway}
              ariaLabel={`${awayTeam?.name ?? "Away"} score`}
            />
          }
        />
      </div>
      {showShootout && (
        <div
          className="flex items-center gap-2 flex-wrap"
          role="group"
          aria-label="Penalty shootout winner"
        >
          <span className="body body-size-xsmall text-[color:var(--color-text-tertiary)]">
            Pens:
          </span>
          <ShootoutToggle
            label={homeTeam?.name ?? "Home"}
            selected={shootout === homeTeamId}
            onSelect={() => setShootout(homeTeamId)}
          />
          <ShootoutToggle
            label={awayTeam?.name ?? "Away"}
            selected={shootout === awayTeamId}
            onSelect={() => setShootout(awayTeamId)}
          />
        </div>
      )}
      {historicGlyph && (
        <span
          className="body body-size-xsmall italic text-[color:var(--color-text-tertiary)] animate-pulse"
          aria-hidden
        >
          {historicGlyph}
        </span>
      )}
      <div className="flex items-center gap-2 border-t border-[color:var(--color-border-secondary)] pt-2.5">
        <Flame
          className="size-3.5 shrink-0 text-[color:var(--color-text-tertiary)]"
          aria-hidden
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          placeholder="Call your shot… (optional)"
          aria-label="Hot take (optional)"
          className="flex-1 min-w-0 rounded-md border border-[color:var(--color-border-primary)] bg-transparent px-2.5 h-7 body body-size-small outline-none focus:border-[color:var(--color-border-hover)] placeholder:text-[color:var(--color-text-tertiary)]"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <SaveBadge pending={pending} status={status} initial={initial !== null} />
        <SubmissionDeadline deadline={deadline} />
      </div>
    </div>
  );
}

function ShootoutToggle({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-md border border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10 px-2 h-6 body body-size-xsmall text-[color:var(--color-text-primary)]"
          : "rounded-md border border-[color:var(--color-border-primary)] px-2 h-6 body body-size-xsmall text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-hover)]"
      }
    >
      {label}
    </button>
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
  return (
    <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
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
