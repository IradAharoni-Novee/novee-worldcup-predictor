"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { submitPodiumPrediction } from "@/lib/actions/podium";

type Person = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

type Initial = { firstId: string; secondId: string; thirdId: string };

const SLOT_LABELS = ["1st", "2nd", "3rd"] as const;

function displayName(p: Person): string {
  return p.name ?? p.email.split("@")[0] ?? p.email;
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

export function PodiumPickerForm({
  people,
  initial,
  locked,
}: {
  people: Person[];
  initial: Initial | null;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<(string | null)[]>([
    initial?.firstId ?? null,
    initial?.secondId ?? null,
    initial?.thirdId ?? null,
  ]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | { error: string }>(
    "idle"
  );
  const lastSavedRef = useRef<string>(
    initial ? `${initial.firstId}|${initial.secondId}|${initial.thirdId}` : ""
  );

  const byId = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const allChosen = picks.every((p) => p !== null);
  const combo = picks.join("|");

  useEffect(() => {
    if (locked || !allChosen || combo === lastSavedRef.current) return;
    const [firstId, secondId, thirdId] = picks as string[];
    startTransition(async () => {
      const fd = new FormData();
      fd.set("firstId", firstId);
      fd.set("secondId", secondId);
      fd.set("thirdId", thirdId);
      const result = await submitPodiumPrediction(null, fd);
      if (result.ok) {
        lastSavedRef.current = combo;
        setStatus("saved");
      } else {
        setStatus({ error: result.error });
      }
    });
  }, [combo, allChosen, locked, picks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        displayName(p).toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [people, query]);

  function choose(id: string) {
    const next = [...picks];
    const existing = next.indexOf(id);
    if (existing !== -1) next[existing] = null;
    next[activeSlot] = id;
    setPicks(next);
    const firstEmpty = next.findIndex((p) => p === null);
    if (firstEmpty !== -1) setActiveSlot(firstEmpty);
  }

  function clearSlot(slot: number) {
    const next = [...picks];
    next[slot] = null;
    setPicks(next);
    setActiveSlot(slot);
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-2">
        {SLOT_LABELS.map((label, i) => {
          const person = picks[i] ? byId.get(picks[i] as string) : undefined;
          return (
            <div
              key={label}
              className="flex items-center gap-3 rounded-md border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] px-3 py-2"
            >
              <span className="code code-size-medium w-8 shrink-0 text-[color:var(--color-text-tertiary)]">
                {label}
              </span>
              {person ? (
                <>
                  <UserAvatar
                    email={person.email}
                    name={person.name}
                    image={person.image}
                    size={28}
                  />
                  <span className="body body-weight-medium body-size-small truncate">
                    {displayName(person)}
                  </span>
                </>
              ) : (
                <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                  No pick
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {SLOT_LABELS.map((label, i) => {
          const person = picks[i] ? byId.get(picks[i] as string) : undefined;
          const active = activeSlot === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveSlot(i)}
              className={
                "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 transition-colors " +
                (active
                  ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10"
                  : "border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)]")
              }
            >
              <span className="code code-size-small text-[color:var(--color-text-tertiary)]">
                {label}
              </span>
              {person ? (
                <>
                  <UserAvatar
                    email={person.email}
                    name={person.name}
                    image={person.image}
                    size={40}
                  />
                  <span className="body body-size-small body-weight-medium truncate max-w-full">
                    {displayName(person)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSlot(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        clearSlot(i);
                      }
                    }}
                    className="inline-flex items-center gap-0.5 body body-size-xsmall text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-accent-danger)]"
                  >
                    <X className="size-3" /> clear
                  </span>
                </>
              ) : (
                <span className="grid size-10 place-items-center rounded-full border border-dashed border-[color:var(--color-border-primary)] text-[color:var(--color-text-tertiary)]">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[color:var(--color-text-tertiary)]" />
        <input
          type="search"
          placeholder={`Search players for ${SLOT_LABELS[activeSlot]}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] pl-8 pr-3 py-2 body body-size-medium"
        />
      </div>

      <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1">
        {filtered.map((p) => {
          const slot = picks.indexOf(p.id);
          const chosen = slot !== -1;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              aria-pressed={chosen}
              className={
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors " +
                (chosen
                  ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10"
                  : "border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)]")
              }
            >
              <UserAvatar
                email={p.email}
                name={p.name}
                image={p.image}
                size={32}
              />
              <div className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="body body-weight-medium body-size-small truncate">
                  {displayName(p)}
                </span>
                <span className="body body-size-small text-[color:var(--color-text-tertiary)] truncate">
                  {p.email}
                </span>
              </div>
              {chosen && (
                <span className="code code-size-small shrink-0 text-[color:var(--color-action-primary-cta)]">
                  {SLOT_LABELS[slot]}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] py-4 text-center">
            No players match your search.
          </p>
        )}
      </div>

      <SaveBadge pending={pending} status={status} />
    </div>
  );
}
