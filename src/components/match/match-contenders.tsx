import Link from "next/link";
import { cn } from "@/lib/cn";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { ContenderRow } from "@/lib/match-contenders";

type Team = { id: string; code: string; name: string };

type Props = {
  rows: ContenderRow[];
  currentUserId: string;
  /** The two sides, for labelling a drawn pick's shootout winner. */
  teams: Team[];
};

/**
 * Ranked list of everyone who predicted a match, highest per-match points
 * first. Rendered post-kickoff only; ties share a rank (1, 1, 3, …). Rows
 * link to profiles and mirror the leaderboard's own-row highlight.
 */
export function MatchContenders({ rows, currentUserId, teams }: Props) {
  if (rows.length === 0) return null;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r) => {
        const me = r.user.id === currentUserId;
        // A drawn knockout pick carries the shootout-winner call; show it as
        // "2–2 · FRA" so the row explains any shootout bonus.
        const shootoutTeam =
          r.homeScore === r.awayScore && r.shootoutWinnerTeamId
            ? teamById.get(r.shootoutWinnerTeamId)
            : undefined;
        return (
          <li
            key={r.user.id}
            className={cn(
              "rounded-md border border-[color:var(--color-border-secondary)] px-4 py-2 body body-size-small flex items-center justify-between gap-3",
              me && "bg-[color:var(--color-category-bg-brand)]/40"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="code code-size-small tabular-nums w-5 text-right shrink-0 text-[color:var(--color-text-tertiary)]">
                {r.rank}
              </span>
              <Link
                href={me ? "/me" : `/u/${r.user.id}`}
                className="flex items-center gap-2 min-w-0 hover:underline"
              >
                <UserAvatar
                  email={r.user.email}
                  name={r.user.name}
                  image={r.user.image}
                  size={24}
                />
                <span className="body-weight-medium truncate">
                  {r.user.name ?? r.user.email.split("@")[0]}
                </span>
                {me && (
                  <span className="text-xs text-[color:var(--color-action-primary-cta)] shrink-0">
                    You
                  </span>
                )}
              </Link>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="code code-size-small tabular-nums text-[color:var(--color-text-secondary)]">
                {r.homeScore}–{r.awayScore}
                {shootoutTeam && (
                  <span
                    className="text-[color:var(--color-text-tertiary)]"
                    title={`Picked ${shootoutTeam.name} to advance on penalties`}
                  >
                    {" · "}
                    {shootoutTeam.code}
                  </span>
                )}
              </span>
              <span className="code code-size-medium tabular-nums w-14 text-right">
                {r.points} pt{r.points === 1 ? "" : "s"}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
