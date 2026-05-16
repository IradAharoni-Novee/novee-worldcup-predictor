"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Stage } from "@prisma/client";
import { Check, Loader2, Trophy } from "lucide-react";
import { submitBracketPicks } from "@/lib/actions/bracket-predictions";

export type Team = { id: string; name: string; code: string; flag?: string | null };

type SeededSlot = {
  slot: number;
  homeId: string | null;
  awayId: string | null;
  homeLabel: string;
  awayLabel: string;
};

type InitialPick = { round: Stage; slot: number; teamId: string };

// Canonical serialization for change detection — same content always produces
// the same string regardless of map / array insertion order.
function serializePicks(input: Map<string, string> | InitialPick[]): string {
  const entries =
    input instanceof Map
      ? [...input]
      : input.map((p) => [`${p.round}:${p.slot}`, p.teamId] as const);
  return entries
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("|");
}

function SaveStatus({
  pending,
  status,
}: {
  pending: boolean;
  status: "idle" | "saved" | { error: string };
}) {
  if (pending) {
    return (
      <p className="body body-size-small text-[color:var(--color-text-secondary)] flex items-center gap-1 self-center">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </p>
    );
  }
  if (status === "saved") {
    return (
      <p className="body body-size-small text-[color:var(--color-accent-success)] flex items-center gap-1 self-center">
        <Check className="size-3.5" /> Saved
      </p>
    );
  }
  if (typeof status === "object") {
    return (
      <p className="body body-size-small text-[color:var(--color-accent-danger)] self-center">
        {status.error}
      </p>
    );
  }
  return null;
}

export function BracketPredictorForm({
  teamsById,
  r32Seeding,
  initialPicks,
}: {
  teamsById: Record<string, Team>;
  r32Seeding: SeededSlot[];
  initialPicks: InitialPick[];
}) {
  const initial = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of initialPicks) map.set(`${p.round}:${p.slot}`, p.teamId);
    return map;
  }, [initialPicks]);

  const [picks, setPicks] = useState<Map<string, string>>(new Map(initial));
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saved" | { error: string }
  >("idle");
  // Track what the server already has so we skip no-op saves (e.g. when the
  // user picks → unpicks → re-picks and lands back on a saved state).
  const lastSavedRef = useRef<string>(serializePicks(initial));

  function setPick(round: Stage, slot: number, teamId: string | null) {
    setPicks((prev) => {
      const next = new Map(prev);
      const key = `${round}:${slot}`;
      const oldTeamId = prev.get(key) ?? null;
      if (teamId == null) next.delete(key);
      else next.set(key, teamId);
      cascadeClear(next, round, slot, oldTeamId);
      return next;
    });
  }

  function cascadeClear(
    map: Map<string, string>,
    round: Stage,
    slot: number,
    oldTeamId: string | null
  ) {
    if (!oldTeamId) return;
    if (round === Stage.R32) maybeClear(map, Stage.R16, Math.floor(slot / 2), oldTeamId);
    else if (round === Stage.R16) maybeClear(map, Stage.QF, Math.floor(slot / 2), oldTeamId);
    else if (round === Stage.QF) maybeClear(map, Stage.SF, Math.floor(slot / 2), oldTeamId);
    else if (round === Stage.SF) {
      maybeClearKey(map, `${Stage.FINAL}:0`, oldTeamId);
      maybeClearKey(map, `${Stage.THIRD}:0`, oldTeamId);
    }
  }

  function maybeClear(
    map: Map<string, string>,
    round: Stage,
    slot: number,
    oldTeamId: string | null
  ) {
    const key = `${round}:${slot}`;
    if (map.get(key) === oldTeamId && oldTeamId) {
      map.delete(key);
      cascadeClear(map, round, slot, oldTeamId);
    }
  }

  function maybeClearKey(map: Map<string, string>, key: string, oldTeamId: string | null) {
    if (map.get(key) === oldTeamId && oldTeamId) map.delete(key);
  }

  function r16Teams(slot: number) {
    return {
      home: picks.get(`${Stage.R32}:${slot * 2}`) ?? null,
      away: picks.get(`${Stage.R32}:${slot * 2 + 1}`) ?? null,
    };
  }
  function qfTeams(slot: number) {
    return {
      home: picks.get(`${Stage.R16}:${slot * 2}`) ?? null,
      away: picks.get(`${Stage.R16}:${slot * 2 + 1}`) ?? null,
    };
  }
  function sfTeams(slot: number) {
    return {
      home: picks.get(`${Stage.QF}:${slot * 2}`) ?? null,
      away: picks.get(`${Stage.QF}:${slot * 2 + 1}`) ?? null,
    };
  }
  function finalTeams() {
    return {
      home: picks.get(`${Stage.SF}:0`) ?? null,
      away: picks.get(`${Stage.SF}:1`) ?? null,
    };
  }
  function thirdTeams() {
    // The two SF losers.
    const sf0home = picks.get(`${Stage.QF}:0`) ?? null;
    const sf0away = picks.get(`${Stage.QF}:1`) ?? null;
    const sf0winner = picks.get(`${Stage.SF}:0`) ?? null;
    const sf1home = picks.get(`${Stage.QF}:2`) ?? null;
    const sf1away = picks.get(`${Stage.QF}:3`) ?? null;
    const sf1winner = picks.get(`${Stage.SF}:1`) ?? null;
    const home =
      sf0winner && sf0home && sf0away
        ? sf0winner === sf0home
          ? sf0away
          : sf0home
        : null;
    const away =
      sf1winner && sf1home && sf1away
        ? sf1winner === sf1home
          ? sf1away
          : sf1home
        : null;
    return { home, away };
  }

  function payload(): InitialPick[] {
    const out: InitialPick[] = [];
    for (const [key, teamId] of picks) {
      const [round, slotStr] = key.split(":");
      out.push({ round: round as Stage, slot: Number(slotStr), teamId });
    }
    return out;
  }

  // Auto-save whenever picks change — but only if the new state differs from
  // what we last sent to the server. Debounced so a quick run through the
  // bracket coalesces into one save instead of one per click.
  useEffect(() => {
    const snapshot = serializePicks(picks);
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("picks", JSON.stringify(payload()));
        const result = await submitBracketPicks(null, fd);
        if (result.ok) {
          lastSavedRef.current = snapshot;
          setSaveStatus("saved");
        } else {
          setSaveStatus({ error: result.error });
        }
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks]);

  const finalWinner = picks.get(`${Stage.FINAL}:0`) ?? null;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <SaveStatus pending={pending} status={saveStatus} />
      <div className="overflow-x-auto pb-4 min-w-0">
        <div className="flex items-stretch w-fit mx-auto min-h-[1100px]">
          <Round label="Round of 32" feedsNext>
            {r32Seeding.map((seed, i) => (
              <BracketSlot key={`r32-${seed.slot}`} pairPos={i % 2 === 0 ? "top" : "bottom"}>
                <MatchCard
                  homeId={seed.homeId}
                  awayId={seed.awayId}
                  homeFallback={seed.homeLabel}
                  awayFallback={seed.awayLabel}
                  winnerId={picks.get(`${Stage.R32}:${seed.slot}`) ?? null}
                  teamsById={teamsById}
                  onPick={(teamId) => setPick(Stage.R32, seed.slot, teamId)}
                />
              </BracketSlot>
            ))}
          </Round>

          <Round label="Round of 16" feedsNext withIncoming>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((slot, i) => {
              const { home, away } = r16Teams(slot);
              return (
                <BracketSlot key={`r16-${slot}`} pairPos={i % 2 === 0 ? "top" : "bottom"}>
                  <MatchCard
                    homeId={home}
                    awayId={away}
                    homeFallback="—"
                    awayFallback="—"
                    winnerId={picks.get(`${Stage.R16}:${slot}`) ?? null}
                    teamsById={teamsById}
                    onPick={(teamId) => setPick(Stage.R16, slot, teamId)}
                  />
                </BracketSlot>
              );
            })}
          </Round>

          <Round label="Quarter-finals" feedsNext withIncoming>
            {[0, 1, 2, 3].map((slot, i) => {
              const { home, away } = qfTeams(slot);
              return (
                <BracketSlot key={`qf-${slot}`} pairPos={i % 2 === 0 ? "top" : "bottom"}>
                  <MatchCard
                    homeId={home}
                    awayId={away}
                    homeFallback="—"
                    awayFallback="—"
                    winnerId={picks.get(`${Stage.QF}:${slot}`) ?? null}
                    teamsById={teamsById}
                    onPick={(teamId) => setPick(Stage.QF, slot, teamId)}
                  />
                </BracketSlot>
              );
            })}
          </Round>

          <Round label="Semi-finals" feedsNext withIncoming>
            {[0, 1].map((slot, i) => {
              const { home, away } = sfTeams(slot);
              return (
                <BracketSlot key={`sf-${slot}`} pairPos={i % 2 === 0 ? "top" : "bottom"}>
                  <MatchCard
                    homeId={home}
                    awayId={away}
                    homeFallback="—"
                    awayFallback="—"
                    winnerId={picks.get(`${Stage.SF}:${slot}`) ?? null}
                    teamsById={teamsById}
                    onPick={(teamId) => setPick(Stage.SF, slot, teamId)}
                  />
                </BracketSlot>
              );
            })}
          </Round>

          <Round label="Final" withIncoming>
            <BracketSlot pairPos="solo">
              {(() => {
                const { home, away } = finalTeams();
                return (
                  <MatchCard
                    homeId={home}
                    awayId={away}
                    homeFallback="—"
                    awayFallback="—"
                    winnerId={finalWinner}
                    teamsById={teamsById}
                    onPick={(teamId) => setPick(Stage.FINAL, 0, teamId)}
                  />
                );
              })()}
              {finalWinner && teamsById[finalWinner] && (
                <div className="mt-3 rounded-md border border-[color:var(--color-accent-warning,var(--color-border-primary))] bg-[color:var(--color-surface-secondary)] px-3 py-2 flex items-center gap-2">
                  <Trophy className="size-4 text-[color:var(--color-accent-warning,var(--color-text-primary))]" />
                  <span className="body body-weight-medium body-size-small">
                    Champion: {teamsById[finalWinner].name}
                  </span>
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2">
                <span className="subheading subheading-size-medium subheading-weight-medium text-[color:var(--color-text-secondary)]">
                  Third-place play-off
                </span>
                {(() => {
                  const { home, away } = thirdTeams();
                  return (
                    <MatchCard
                      homeId={home}
                      awayId={away}
                      homeFallback="SF1 loser"
                      awayFallback="SF2 loser"
                      winnerId={picks.get(`${Stage.THIRD}:0`) ?? null}
                      teamsById={teamsById}
                      onPick={(teamId) => setPick(Stage.THIRD, 0, teamId)}
                    />
                  );
                })()}
              </div>
            </BracketSlot>
          </Round>
        </div>
      </div>

    </div>
  );
}

function Round({
  label,
  feedsNext,
  withIncoming,
  children,
}: {
  label: string;
  feedsNext?: boolean;
  withIncoming?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-feeds={feedsNext ? "true" : "false"}
      data-incoming={withIncoming ? "true" : "false"}
      className="flex flex-col flex-shrink-0"
      style={{
        width: feedsNext ? 240 : 220,
        paddingRight: feedsNext ? 20 : 0,
        paddingLeft: withIncoming ? 0 : 0,
      }}
    >
      <h3 className="subheading subheading-size-medium subheading-weight-medium text-[color:var(--color-text-secondary)] mb-2">
        {label}
      </h3>
      <div className="flex flex-col flex-1 justify-around gap-0">{children}</div>
    </div>
  );
}

function BracketSlot({
  pairPos,
  children,
}: {
  pairPos: "top" | "bottom" | "solo";
  children: React.ReactNode;
}) {
  // Decorative connector lines drawn via absolutely-positioned elements.
  return (
    <div className="relative flex-1 flex items-center min-h-[64px] py-1">
      <div className="w-[220px]">{children}</div>
      {pairPos !== "solo" && (
        <>
          {/* horizontal stub from match's right edge to the vertical join */}
          <span
            aria-hidden
            className="absolute top-1/2 right-0 h-px bg-[color:var(--color-border-secondary)]"
            style={{ width: 20, transform: "translateY(-0.5px)" }}
          />
          {/* vertical segment from this slot's center toward the pair midpoint */}
          {pairPos === "top" ? (
            <span
              aria-hidden
              className="absolute right-0 w-px bg-[color:var(--color-border-secondary)]"
              style={{ top: "50%", bottom: 0 }}
            />
          ) : (
            <span
              aria-hidden
              className="absolute right-0 w-px bg-[color:var(--color-border-secondary)]"
              style={{ top: 0, bottom: "50%" }}
            />
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({
  homeId,
  awayId,
  homeFallback,
  awayFallback,
  winnerId,
  teamsById,
  onPick,
}: {
  homeId: string | null;
  awayId: string | null;
  homeFallback: string;
  awayFallback: string;
  winnerId: string | null;
  teamsById: Record<string, Team>;
  onPick: (teamId: string | null) => void;
}) {
  const homeTeam = homeId ? teamsById[homeId] ?? null : null;
  const awayTeam = awayId ? teamsById[awayId] ?? null : null;

  return (
    <div className="rounded-md border border-[color:var(--color-border-primary)] overflow-hidden bg-[color:var(--color-surface-primary)] shadow-sm">
      <TeamRow
        team={homeTeam}
        fallback={homeFallback}
        isWinner={winnerId !== null && winnerId === homeId}
        canPick={Boolean(homeId)}
        onPick={() => homeId && onPick(winnerId === homeId ? null : homeId)}
      />
      <TeamRow
        team={awayTeam}
        fallback={awayFallback}
        isWinner={winnerId !== null && winnerId === awayId}
        canPick={Boolean(awayId)}
        onPick={() => awayId && onPick(winnerId === awayId ? null : awayId)}
        borderTop
      />
    </div>
  );
}

function TeamRow({
  team,
  fallback,
  isWinner,
  canPick,
  onPick,
  borderTop,
}: {
  team: Team | null;
  fallback: string;
  isWinner: boolean;
  canPick: boolean;
  onPick: () => void;
  borderTop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!canPick}
      className={
        (borderTop ? "border-t border-[color:var(--color-border-secondary)] " : "") +
        "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors " +
        (isWinner
          ? "bg-[color:var(--color-action-primary-cta)]/12 body-weight-medium"
          : canPick
            ? "hover:bg-[color:var(--color-surface-hover)]"
            : "text-[color:var(--color-text-tertiary)] cursor-not-allowed")
      }
    >
      {team?.flag ? (
        <img
          src={team.flag}
          alt=""
          className="w-5 h-4 rounded-sm object-cover shrink-0"
        />
      ) : (
        <span className="w-5 h-4 shrink-0" />
      )}
      <span className="body body-size-small truncate flex-1">
        {team ? team.name : fallback}
      </span>
      {isWinner && (
        <Check className="size-4 text-[color:var(--color-accent-success)] shrink-0" />
      )}
    </button>
  );
}
