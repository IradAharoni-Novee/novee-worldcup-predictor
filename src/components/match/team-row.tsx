import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TeamLite = { name: string; code: string; flag: string | null } | null;

// A single team line: flag + name on the left, a caller-supplied control on
// the right (a score readout when locked, a score stepper when editable).
// Keeping the row shared guarantees the team↔score column stays aligned across
// both states. `dim` fades the row for the losing side of a finished match.
export function TeamRow({
  team,
  right,
  dim = false,
}: {
  team: TeamLite;
  right: ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 transition-opacity",
        dim && "opacity-45"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {team?.flag ? (
          <span className="size-5 relative shrink-0">
            <Image
              src={team.flag}
              alt=""
              fill
              sizes="20px"
              className="rounded-sm object-contain"
              unoptimized
            />
          </span>
        ) : (
          <span className="size-5 rounded-sm bg-[color:var(--color-surface-emphasis)] grid place-items-center text-[10px] text-[color:var(--color-text-tertiary)]">
            ?
          </span>
        )}
        <span className="body body-size-medium truncate">
          {team?.name ?? "TBD"}
        </span>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}
