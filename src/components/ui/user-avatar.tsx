import { AvatarImage } from "@/components/ui/avatar-image";
import { aiPlayerAvatar } from "@/lib/ai-players";
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
  // AI bots always render their brand mark, regardless of any DB image.
  const bot = aiPlayerAvatar(email);
  if (bot) {
    return (
      <img
        src={`/avatars/${bot.file}`}
        alt={bot.label}
        width={size}
        height={size}
        className={cn("rounded-full", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const { bg, fg } = pickColor(email);
  const fallback = (
    <div
      className={cn(
        "rounded-full grid place-items-center font-medium tabular-nums",
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
  // Real photo (typically from Slack) trumps initials, but a broken URL falls
  // back to initials instead of the browser's broken-image icon.
  if (image) {
    return (
      <AvatarImage
        src={image}
        alt={name ?? email}
        size={size}
        className={className}
        fallback={fallback}
      />
    );
  }
  return fallback;
}
