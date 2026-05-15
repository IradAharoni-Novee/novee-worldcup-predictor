import { AnthropicMark, OpenAIMark } from "@/components/ui/brand-marks";
import { cn } from "@/lib/cn";

// Subtle deterministic color picker for human initials avatars
const PALETTE = [
  { bg: "var(--color-category-bg-brand)", fg: "var(--color-category-surface-brand)" },
  { bg: "var(--color-category-bg-blue)", fg: "var(--color-category-surface-blue)" },
  { bg: "var(--color-category-bg-green)", fg: "var(--color-category-surface-green)" },
  { bg: "var(--color-category-bg-amber)", fg: "var(--color-category-surface-amber)" },
  { bg: "var(--color-category-bg-orange)", fg: "var(--color-category-surface-orange)" },
  { bg: "var(--color-category-bg-cyan)", fg: "var(--color-category-surface-cyan)" },
] as const;

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

function initials(name: string | null | undefined, email: string): string {
  const source = (name?.trim() || email.split("@")[0] || "?").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  email,
  name,
  image,
  size = 28,
  className,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const local = email.toLowerCase();
  // AI bots always render their brand mark, regardless of any DB image.
  if (local.startsWith("opus-") || local.startsWith("claude")) {
    return <AnthropicMark size={size} />;
  }
  if (local.startsWith("gpt-") || local.startsWith("chatgpt")) {
    return <OpenAIMark size={size} />;
  }
  // Real photo (typically from Slack) trumps initials.
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? email}
        width={size}
        height={size}
        className={cn("rounded-md object-cover", className)}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  const { bg, fg } = pickColor(email);
  return (
    <div
      className={cn(
        "rounded-md grid place-items-center font-medium tabular-nums",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize: Math.round(size * 0.42),
      }}
      aria-label={name ?? email}
    >
      {initials(name, email)}
    </div>
  );
}
