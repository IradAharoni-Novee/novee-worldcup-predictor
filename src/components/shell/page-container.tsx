import * as React from "react";
import { cn } from "@/lib/cn";

export function PageContainer({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 flex flex-col h-full pt-4 px-4 sm:px-6 min-h-0 min-w-0", className)}>
      <div className="flex flex-row justify-between items-center gap-3 shrink-0">
        <PageTitle>{title}</PageTitle>
        {action}
      </div>
      <div className="flex-1 flex flex-col h-full mt-4 min-h-0 min-w-0">{children}</div>
    </div>
  );
}

export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("heading capitalize", className)}>{children}</div>;
}
