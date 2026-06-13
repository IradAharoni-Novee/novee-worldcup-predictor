"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatKickoff } from "@/lib/format";
import { useTimeZone } from "@/components/providers/timezone-provider";

export function LocalKickoff({ date, className }: { date: Date; className?: string }) {
  const timeZone = useTimeZone();
  return <span className={className}>{formatKickoff(date, timeZone)}</span>;
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
  const timeZone = useTimeZone();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 body body-size-small text-[color:var(--color-text-tertiary)]",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span>
        {label} {formatKickoff(deadline, timeZone)}
      </span>
    </span>
  );
}
