"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import {
  submitGoldenBootPrediction,
  submitWinnerPrediction,
} from "@/lib/actions/awards";

type Team = { id: string; name: string; code: string; flag: string | null };

type Player = {
  id: string;
  name: string;
  position: string | null;
  teamName: string | null;
  teamFlag: string | null;
  photo: string | null;
};

function SaveBadge({
  pending,
  status,
}: {
  pending: boolean;
  status: "idle" | "saved" | { error: string };
}) {
  if (pending) {
    return (
      <span className="body body-size-small text-[color:var(--color-text-secondary)] flex items-center gap-1 self-start">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="body body-size-small text-[color:var(--color-accent-success)] flex items-center gap-1 self-start">
        <Check className="size-3.5" /> Saved
      </span>
    );
  }
  if (typeof status === "object") {
    return (
      <span className="body body-size-small text-[color:var(--color-accent-danger)] self-start">
        {status.error}
      </span>
    );
  }
  return null;
}

export function WinnerPickerForm({
  teams,
  initial,
  locked,
}: {
  teams: Team[];
  initial: { teamId: string } | null;
  locked: boolean;
}) {
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | { error: string }>(
    "idle"
  );
  const lastSavedRef = useRef<string>(initial?.teamId ?? "");

  useEffect(() => {
    if (!teamId) return;
    if (teamId === lastSavedRef.current) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("teamId", teamId);
      const result = await submitWinnerPrediction(null, fd);
      if (result.ok) {
        lastSavedRef.current = teamId;
        setStatus("saved");
      } else {
        setStatus({ error: result.error });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (locked) {
    const team = teams.find((t) => t.id === initial?.teamId);
    return (
      <div className="rounded-md border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] px-4 py-3 flex items-center gap-3">
        {team?.flag && (
          <img src={team.flag} alt="" className="w-8 h-6 rounded-sm object-cover" />
        )}
        <span className="body body-size-medium text-[color:var(--color-text-secondary)]">
          {team ? (
            <>
              Your pick:{" "}
              <span className="body-weight-medium text-[color:var(--color-text-primary)]">
                {team.name}
              </span>
            </>
          ) : (
            "Tournament locked — no winner pick was submitted."
          )}
        </span>
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[color:var(--color-text-tertiary)]" />
        <input
          type="search"
          placeholder="Search teams…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] pl-8 pr-3 py-2 body body-size-medium"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {filtered.map((t) => {
          const selected = teamId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(t.id)}
              aria-pressed={selected}
              className={
                "flex items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors " +
                (selected
                  ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10"
                  : "border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)]")
              }
            >
              {t.flag && (
                <img
                  src={t.flag}
                  alt=""
                  className="w-7 h-5 rounded-sm object-cover shrink-0"
                />
              )}
              <span className="body body-size-small body-weight-medium truncate">
                {t.name}
              </span>
              {selected && (
                <Check className="size-4 text-[color:var(--color-accent-success)] ml-auto shrink-0" />
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full body body-size-small text-[color:var(--color-text-tertiary)] py-4 text-center">
            No teams match your search.
          </p>
        )}
      </div>
      <SaveBadge pending={pending} status={status} />
    </div>
  );
}

export function GoldenBootPickerForm({
  players,
  initial,
  locked,
}: {
  players: Player[];
  initial: { playerId: string } | null;
  locked: boolean;
}) {
  const [query, setQuery] = useState("");
  const [playerId, setPlayerId] = useState(initial?.playerId ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | { error: string }>(
    "idle"
  );
  const lastSavedRef = useRef<string>(initial?.playerId ?? "");

  useEffect(() => {
    if (!playerId) return;
    if (playerId === lastSavedRef.current) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("playerId", playerId);
      const result = await submitGoldenBootPrediction(null, fd);
      if (result.ok) {
        lastSavedRef.current = playerId;
        setStatus("saved");
      } else {
        setStatus({ error: result.error });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const selected = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players.slice(0, 80);
    const matches = players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.teamName?.toLowerCase().includes(q)
    );
    return matches.slice(0, 80);
  }, [players, query]);

  if (locked) {
    const player = players.find((p) => p.id === initial?.playerId);
    return (
      <div className="rounded-md border border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)] px-4 py-3 flex items-center gap-3">
        {player ? (
          <>
            <PlayerAvatar
              name={player.name}
              photo={player.photo}
              teamFlag={player.teamFlag}
              teamName={player.teamName}
              size={36}
            />
            <span className="body body-size-medium text-[color:var(--color-text-secondary)]">
              Your pick:{" "}
              <span className="body-weight-medium text-[color:var(--color-text-primary)]">
                {player.name}
              </span>
              {player.teamName ? ` (${player.teamName})` : null}
            </span>
          </>
        ) : (
          <span className="body body-size-medium text-[color:var(--color-text-secondary)]">
            Tournament locked — no golden boot pick was submitted.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[color:var(--color-text-tertiary)]" />
        <input
          type="search"
          placeholder="Search by name or team…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-[color:var(--color-border-primary)] bg-[color:var(--color-surface-primary)] pl-8 pr-3 py-2 body body-size-medium"
        />
      </div>
      {selected && (
        <div className="flex items-center gap-3 rounded-md border border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10 px-3 py-2">
          <PlayerAvatar
            name={selected.name}
            photo={selected.photo}
            teamFlag={selected.teamFlag}
            teamName={selected.teamName}
            size={40}
          />
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <span className="body body-weight-medium body-size-medium truncate">
              {selected.name}
            </span>
            <span className="body body-size-small text-[color:var(--color-text-tertiary)] truncate">
              {selected.teamName ?? "Unattached"}
              {selected.position ? ` · ${selected.position}` : ""}
            </span>
          </div>
          <Check className="size-5 text-[color:var(--color-accent-success)] shrink-0" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1">
        {filtered.map((p) => {
          const isSelected = p.id === playerId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlayerId(p.id)}
              aria-pressed={isSelected}
              className={
                "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors " +
                (isSelected
                  ? "border-[color:var(--color-action-primary-cta)] bg-[color:var(--color-action-primary-cta)]/10"
                  : "border-[color:var(--color-border-primary)] hover:bg-[color:var(--color-surface-hover)]")
              }
            >
              <PlayerAvatar
                name={p.name}
                photo={p.photo}
                teamFlag={p.teamFlag}
                teamName={p.teamName}
                size={36}
              />
              <div className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="body body-weight-medium body-size-small truncate">
                  {p.name}
                </span>
                <span className="body body-size-small text-[color:var(--color-text-tertiary)] truncate">
                  {p.teamName ?? "Unattached"}
                  {p.position ? ` · ${p.position}` : ""}
                </span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] py-4 text-center">
            {query ? "No players match your search." : "Loading players…"}
          </p>
        )}
        {!query && players.length > filtered.length && (
          <p className="body body-size-small text-[color:var(--color-text-tertiary)] py-2 text-center">
            Showing first {filtered.length} of {players.length} players. Search to narrow.
          </p>
        )}
      </div>
      <SaveBadge pending={pending} status={status} />
    </div>
  );
}
