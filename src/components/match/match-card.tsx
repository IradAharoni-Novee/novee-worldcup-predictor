import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Chip, type ChipColor } from "@/components/ui/chip";
import { formatKickoff, isLocked, stageLabel } from "@/lib/format";
import { InlineScoreEditor } from "@/components/match/inline-score-editor";

type TeamLite = { name: string; code: string; flag: string | null } | null;

export type MatchCardProps = {
  id: string;
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
  group: string | null;
  kickoff: Date;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  prediction?: { homeScore: number; awayScore: number } | null;
  points?: number | null;
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

function TeamRow({ team, score }: { team: TeamLite; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {team?.flag ? (
          <Image
            src={team.flag}
            alt=""
            width={20}
            height={14}
            className="size-5 rounded-sm object-contain"
            unoptimized
          />
        ) : (
          <span className="size-5 rounded-sm bg-[color:var(--color-surface-emphasis)] grid place-items-center text-[10px] text-[color:var(--color-text-tertiary)]">
            ?
          </span>
        )}
        <span className="body body-size-medium truncate">
          {team?.name ?? "TBD"}
        </span>
      </div>
      <span className="code code-size-large tabular-nums w-6 text-right">
        {score ?? "—"}
      </span>
    </div>
  );
}

export function MatchCard({
  id,
  stage,
  group,
  kickoff,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status,
  prediction,
  points,
}: MatchCardProps) {
  const locked = isLocked(kickoff) || status !== "SCHEDULED";
  return (
    <Card className="gap-3 py-4 hover:border-[color:var(--color-border-hover)] transition-colors">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Chip
            size="small"
            color={stageChipColor(stage)}
            label={stageLabel(stage, group)}
          />
          {status === "LIVE" && <Chip size="small" color="red" label="LIVE" />}
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
          {formatKickoff(kickoff)}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <div className="px-4 flex flex-col gap-1.5">
        <TeamRow team={homeTeam} score={homeScore} />
        <TeamRow team={awayTeam} score={awayScore} />
      </div>
      <div className="px-4 pt-2 border-t border-[color:var(--color-border-secondary)]">
        {locked ? (
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
        ) : (
          <InlineScoreEditor matchId={id} initial={prediction ?? null} />
        )}
      </div>
    </Card>
  );
}
