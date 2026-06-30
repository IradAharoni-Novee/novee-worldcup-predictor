import Link from "next/link";
import { ArrowUpRight, Info, Lock, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Chip, type ChipColor } from "@/components/ui/chip";
import { isLocked, isMatchLive, losingSide, stageLabel } from "@/lib/format";
import { InlineScoreEditor } from "@/components/match/inline-score-editor";
import { LiveBadge } from "@/components/match/live-badge";
import { TeamRow, type TeamLite } from "@/components/match/team-row";
import { LocalKickoff } from "@/components/predictor/submission-deadline";

export type MatchCardProps = {
  id: string;
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
  group: string | null;
  // 1-based number within the round (e.g. Round of 16 #3), shown next to the
  // stage chip so that "Winner of R16 #3" labels on later rounds point here.
  matchNo?: number | null;
  kickoff: Date;
  venue: string | null;
  city: string | null;
  country: string | null;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  // Team ids (distinct from the display TeamLite) so the inline editor can offer
  // a penalty-shootout-winner pick for level knockout predictions.
  homeTeamId: string | null;
  awayTeamId: string | null;
  // The team that advanced. For a knockout decided on penalties the score stays
  // level, so this is how the card knows which side to dim as the loser.
  advancingTeamId?: string | null;
  // Bracket position labels (e.g. "2nd A") shown when a knockout team is still
  // undecided, plus `provisional` when the teams shown are projected from live
  // group standings rather than officially set.
  homeFallback?: string;
  awayFallback?: string;
  provisional?: boolean;
  homeScore: number | null;
  awayScore: number | null;
  // Penalty-shootout score (home–away), present only for a knockout decided on
  // penalties. Shown below the level scoreline; never affects points.
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  prediction?: {
    homeScore: number;
    awayScore: number;
    shootoutWinnerTeamId?: string | null;
    note?: string | null;
  } | null;
  points?: number | null;
  odds?: { home: number; draw: number; away: number } | null;
  // Marks this card as the "jump to recent matches" scroll target — the first
  // upcoming/live match after a run of finished ones.
  recentAnchor?: boolean;
};

function stageChipColor(stage: MatchCardProps["stage"]): ChipColor {
  switch (stage) {
    case "GROUP":
      return "slate";
    case "FINAL":
      return "brand";
    case "SF":
    case "THIRD":
      return "amber";
    case "QF":
      return "orange";
    default:
      return "blue";
  }
}

function ScoreReadout({ score }: { score: number | null }) {
  return (
    <span className="code code-size-large tabular-nums w-6 text-right inline-block">
      {score ?? "—"}
    </span>
  );
}

function OddsRow({
  odds,
}: {
  odds: { home: number; draw: number; away: number };
}) {
  // Lowest decimal price is the bookmakers' favourite — highlight it.
  const shortest = Math.min(odds.home, odds.draw, odds.away);
  const cells = [
    { label: "1", value: odds.home },
    { label: "X", value: odds.draw },
    { label: "2", value: odds.away },
  ];
  return (
    <div className="px-4 flex items-center gap-3 body body-size-small text-[color:var(--color-text-tertiary)]">
      <span className="shrink-0">Odds</span>
      <span className="flex items-center gap-3">
        {cells.map((c) => (
          <span key={c.label} className="flex items-center gap-1">
            <span>{c.label}</span>
            <span
              className={cn(
                "code code-size-medium tabular-nums",
                c.value === shortest
                  ? "text-[color:var(--color-text-primary)]"
                  : "text-[color:var(--color-text-secondary)]"
              )}
            >
              {c.value.toFixed(2)}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function VenueLine({
  venue,
  city,
  country,
}: {
  venue: string | null;
  city: string | null;
  country: string | null;
}) {
  if (!venue) return null;
  const locationParts = [city, country].filter(Boolean);
  return (
    <div className="px-4 flex items-start gap-1.5 body body-size-small text-[color:var(--color-text-tertiary)]">
      <MapPin className="size-3.5 mt-0.5 shrink-0" />
      <span className="min-w-0">
        <span className="text-[color:var(--color-text-secondary)]">{venue}</span>
        {locationParts.length > 0 && <span> · {locationParts.join(", ")}</span>}
      </span>
    </div>
  );
}

export function MatchCard({
  id,
  stage,
  group,
  matchNo,
  kickoff,
  venue,
  city,
  country,
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  advancingTeamId,
  homeFallback,
  awayFallback,
  provisional = false,
  homeScore,
  awayScore,
  penaltyHome,
  penaltyAway,
  status,
  prediction,
  points,
  odds,
  recentAnchor = false,
}: MatchCardProps) {
  const locked = isLocked(kickoff) || status !== "SCHEDULED";
  const live = isMatchLive(status, kickoff);
  const loser = losingSide({
    status,
    homeScore,
    awayScore,
    homeTeamId,
    awayTeamId,
    advancingTeamId,
  });
  return (
    <Card
      {...(recentAnchor && { id: "recent-matches", "data-recent-matches": true })}
      className="gap-3 py-4 scroll-mt-20 hover:border-[color:var(--color-border-hover)] transition-colors"
    >
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Chip
            size="small"
            color={stageChipColor(stage)}
            label={stageLabel(stage, group)}
          />
          {matchNo != null && (
            <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
              #{matchNo}
            </span>
          )}
          {live && <LiveBadge />}
          {status === "FINISHED" && points != null && (
            <Chip
              size="small"
              color={points > 0 ? "green" : "slate"}
              label={
                <span className="flex items-center gap-1">
                  <Trophy className="size-3" />
                  {points} pt{points === 1 ? "" : "s"}
                </span>
              }
            />
          )}
        </div>
        <Link
          href={`/matches/${id}`}
          className="inline-flex items-center gap-1 body body-size-small text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          aria-label="Match details"
        >
          <LocalKickoff date={kickoff} />
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {locked ? (
        <>
          <div className="px-4 flex flex-col gap-1.5">
            <TeamRow
              team={homeTeam}
              fallback={homeFallback}
              right={<ScoreReadout score={homeScore} />}
              dim={loser === "home"}
            />
            <TeamRow
              team={awayTeam}
              fallback={awayFallback}
              right={<ScoreReadout score={awayScore} />}
              dim={loser === "away"}
            />
          </div>
          {penaltyHome != null && penaltyAway != null && (
            <p className="px-4 -mt-1 text-center body body-size-small text-[color:var(--color-text-tertiary)]">
              Penalties:{" "}
              <span className="code code-size-medium tabular-nums">
                {penaltyHome}–{penaltyAway}
              </span>
            </p>
          )}
          <div className="px-4 pt-2 border-t border-[color:var(--color-border-secondary)]">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "body body-size-small",
                  prediction
                    ? "text-[color:var(--color-text-primary)]"
                    : "text-[color:var(--color-text-tertiary)]"
                )}
              >
                {prediction ? (
                  <>
                    Your pick:{" "}
                    <span className="code code-size-medium">
                      {prediction.homeScore}–{prediction.awayScore}
                    </span>
                  </>
                ) : (
                  "No prediction submitted"
                )}
              </span>
              <Lock className="size-3.5 text-[color:var(--color-text-tertiary)]" />
            </div>
          </div>
        </>
      ) : (
        <InlineScoreEditor
          matchId={id}
          initial={prediction ?? null}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeFallback={homeFallback}
          awayFallback={awayFallback}
          deadline={kickoff}
          knockout={stage !== "GROUP"}
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
        />
      )}

      {provisional && <ProvisionalNote />}
      {odds && <OddsRow odds={odds} />}

      <VenueLine venue={venue} city={city} country={country} />
    </Card>
  );
}

// Shown on a knockout fixture whose teams are filled from the current group
// standings — the matchup can still change until the group stage ends.
function ProvisionalNote() {
  return (
    <div className="px-4 flex items-start gap-1.5 body body-size-small text-[color:var(--color-text-tertiary)] italic">
      <Info className="size-3.5 mt-0.5 shrink-0" />
      <span>Projected from current group standings — not final.</span>
    </div>
  );
}
