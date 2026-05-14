import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const inputVariants = cva(
  "flex w-full min-w-0 rounded-md bg-transparent text-sm font-normal text-[color:var(--color-text-primary)] outline-none transition-[color,box-shadow,border-color,background-color] selection:bg-primary selection:text-primary-foreground placeholder:text-[color:var(--color-text-tertiary)] disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        outline: [
          "border border-input shadow-xs",
          "hover:bg-[var(--input-bg-hover)] hover:border-[var(--input-border-hover)]",
          "focus-visible:border-[var(--input-border-active)] focus-visible:ring-[1px] focus-visible:ring-inset focus-visible:ring-[var(--input-border-active)]",
          "disabled:bg-[var(--input-bg-disabled)] disabled:text-[color:var(--color-text-disabled)]",
          "read-only:bg-[var(--input-bg-disabled)] read-only:cursor-default",
          "aria-invalid:border-destructive aria-invalid:ring-[1px] aria-invalid:ring-inset aria-invalid:ring-destructive",
        ],
        ghost: "border-none",
      },
      size: {
        md: "h-8 px-3 py-1.5",
        lg: "h-9 px-3 py-2",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  }
);

function Input({
  className,
  type,
  variant,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Input, inputVariants };
