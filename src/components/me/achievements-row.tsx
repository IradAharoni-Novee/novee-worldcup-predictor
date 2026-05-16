import { Sparkles } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Achievement } from "@/lib/achievements";

/**
 * Render every achievement as a chip. Earned ones glow in brand purple,
 * unearned ones ghost out. Each chip tooltips its description so users can
 * see what they're chasing without leaving the page.
 */
export function AchievementsRow({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-2">
        {achievements.map((a) => (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <span className={a.earned ? "" : "opacity-40"}>
                <Chip
                  size="regular"
                  color={a.earned ? "brand" : "slate"}
                  label={
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-3" />
                      {a.label}
                    </span>
                  }
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span>
                {a.description}
                {a.earned ? " · Earned." : " · Locked."}
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
