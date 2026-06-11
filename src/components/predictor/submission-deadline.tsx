"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatKickoff } from "@/lib/format";

// Client components so the hour renders in the viewer's timezone; the
// server-rendered (server-TZ) text is patched at hydration, which is why the
// mismatch warning is suppressed.
export function LocalKickoff({ date }: { date: Date }) {
  return <span suppressHydrationWarning>{formatKickoff(date)}</span>;
}

export function SubmissionDeadline({
  deadline,
  label = "Submit by",
  className,
}: {
  deadline: Date;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 body body-size-small text-[color:var(--color-text-tertiary)]",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span suppressHydrationWarning>
        {label} {formatKickoff(deadline)}
      </span>
    </span>
  );
}
