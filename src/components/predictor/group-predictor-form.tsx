"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, GripVertical, Loader2 } from "lucide-react";
import { submitGroupPrediction } from "@/lib/actions/group-predictions";

type Team = { id: string; name: string; code: string; flag: string | null };

type Initial = {
  team1stId: string;
  team2ndId: string;
  team3rdId: string;
  team4thId: string;
} | null;

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];
const POSITION_BADGES = ["🥇", "🥈", "🥉", "4️⃣"];

function serializeOrder(teams: Team[]): string {
  return teams.map((t) => t.id).join("|");
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

function orderTeams(teams: Team[], initial: Initial): Team[] {
  if (!initial) return [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const ordered: Team[] = [];
  for (const id of [
    initial.team1stId,
    initial.team2ndId,
    initial.team3rdId,
    initial.team4thId,
  ]) {
    const t = byId.get(id);
    if (t) {
      ordered.push(t);
      byId.delete(id);
    }
  }
  for (const t of byId.values()) ordered.push(t);
  return ordered;
}

export function GroupPredictorForm({
  group,
  teams,
  initial,
}: {
  group: string;
  teams: Team[];
  initial: Initial;
}) {
  const initialOrder = orderTeams(teams, initial);
  const [order, setOrder] = useState<Team[]>(() => initialOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saved" | { error: string }
  >("idle");
  const lastSavedRef = useRef<string>(serializeOrder(initialOrder));

  useEffect(() => {
    const snapshot = serializeOrder(order);
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("group", group);
        fd.set("team1stId", order[0]?.id ?? "");
        fd.set("team2ndId", order[1]?.id ?? "");
        fd.set("team3rdId", order[2]?.id ?? "");
        fd.set("team4thId", order[3]?.id ?? "");
        const result = await submitGroupPrediction(null, fd);
        if (result.ok) {
          lastSavedRef.current = snapshot;
          setSaveStatus("saved");
        } else {
          setSaveStatus({ error: result.error });
        }
      });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  function move(from: number, to: number) {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onDragStart(e: React.DragEvent<HTMLLIElement>, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function onDragOver(e: React.DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function onDrop(e: React.DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault();
    const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
    if (Number.isFinite(from)) move(from, index);
    setDragIndex(null);
    setOverIndex(null);
  }

  function onDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
          Drag teams to rank them. Top is your predicted group winner.
        </p>
        <SaveBadge pending={pending} status={saveStatus} />
      </div>

      <ul className="flex flex-col gap-2">
        {order.map((team, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <li
              key={team.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragLeave={() => setOverIndex(null)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              aria-grabbed={isDragging}
              className={
                "flex items-center gap-3 rounded-md border px-3 py-3 select-none cursor-grab active:cursor-grabbing transition-all " +
                (isDragging
                  ? "opacity-50 border-[color:var(--color-action-primary-cta)]"
                  : isOver
                    ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-surface-hover)]"
                    : "border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] hover:border-[color:var(--color-border-hover)]")
              }
            >
              <span
                aria-label={POSITION_LABELS[index]}
                className="flex items-center gap-2 min-w-[3.25rem]"
              >
                <span className="text-lg" aria-hidden>
                  {POSITION_BADGES[index]}
                </span>
                <span className="code code-size-small tabular-nums text-[color:var(--color-text-tertiary)]">
                  {POSITION_LABELS[index]}
                </span>
              </span>
              {team.flag && (
                <img
                  src={team.flag}
                  alt=""
                  className="w-8 h-6 rounded-sm object-cover"
                />
              )}
              <span className="body body-weight-medium body-size-medium flex-1 truncate">
                {team.name}
              </span>
              <GripVertical
                className="size-4 text-[color:var(--color-text-tertiary)]"
                aria-hidden
              />
            </li>
          );
        })}
      </ul>

    </div>
  );
}
