import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

// A pulsing dot signalling a match is in progress. The outer ring pings; the
// inner core stays solid. Reduced-motion users just see the solid dot.
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-1.5", className)} aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--chip-surface-red)] opacity-75 motion-reduce:hidden" />
      <span className="relative inline-flex size-1.5 rounded-full bg-[var(--chip-surface-red)]" />
    </span>
  );
}

// The shared "LIVE" badge used on match cards and the match detail page.
export function LiveBadge() {
  return (
    <Chip
      size="small"
      color="red"
      label={
        <span className="flex items-center gap-1.5">
          <LiveDot />
          LIVE
        </span>
      }
    />
  );
}
