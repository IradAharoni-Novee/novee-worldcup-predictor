import { cn } from "@/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-[color:var(--color-surface-emphasis)]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
