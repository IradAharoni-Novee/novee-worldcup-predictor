import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const chipVariants = cva(
  "text-center select-none border rounded-full py-[2px] px-[8px] body body-weight-medium body-size-small inline-flex items-center gap-1 transition-colors w-fit max-w-full",
  {
    variants: {
      color: {
        slate:
          "bg-[var(--chip-bg-grey)] border-[var(--chip-border-grey)] text-[var(--chip-surface-grey)]",
        brand:
          "bg-[var(--chip-bg-brand)] border-[var(--chip-border-brand)] text-[var(--chip-surface-brand)]",
        blue: "bg-[var(--chip-bg-blue)] border-[var(--chip-border-blue)] text-[var(--chip-surface-blue)]",
        green:
          "bg-[var(--chip-bg-green)] border-[var(--chip-border-green)] text-[var(--chip-surface-green)]",
        red: "bg-[var(--chip-bg-red)] border-[var(--chip-border-red)] text-[var(--chip-surface-red)]",
        amber:
          "bg-[var(--chip-bg-amber)] border-[var(--chip-border-amber)] text-[var(--chip-surface-amber)]",
        orange:
          "bg-[var(--chip-bg-orange)] border-[var(--chip-border-orange)] text-[var(--chip-surface-orange)]",
        cyan: "bg-[var(--chip-bg-cyan)] border-[var(--chip-border-cyan)] text-[var(--chip-surface-cyan)]",
      },
      size: {
        small: "h-[18px]",
        regular: "h-[24px]",
      },
    },
    defaultVariants: { color: "slate", size: "regular" },
  }
);

export type ChipColor = NonNullable<VariantProps<typeof chipVariants>["color"]>;

export interface ChipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof chipVariants> {
  label: React.ReactNode;
}

export function Chip({ label, color, size, className, ...props }: ChipProps) {
  return (
    <div className={cn(chipVariants({ color, size }), className)} {...props}>
      {label}
    </div>
  );
}
