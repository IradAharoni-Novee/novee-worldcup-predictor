import { cn } from "@/lib/cn";

type Props = {
  name: string;
  photo?: string | null;
  teamFlag?: string | null;
  teamName?: string | null;
  size?: number;
  className?: string;
};

const PALETTE = [
  "bg-[#8e55fd] text-white",
  "bg-[#3b82f6] text-white",
  "bg-[#10b981] text-white",
  "bg-[#f59e0b] text-white",
  "bg-[#ef4444] text-white",
  "bg-[#a855f7] text-white",
  "bg-[#0ea5e9] text-white",
  "bg-[#14b8a6] text-white",
];

function initials(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function paletteFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function PlayerAvatar({
  name,
  photo,
  teamFlag,
  teamName,
  size = 40,
  className,
}: Props) {
  const dim = { width: size, height: size };
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={dim}
      aria-label={teamName ? `${name}, ${teamName}` : name}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          className="rounded-full object-cover w-full h-full bg-[color:var(--color-surface-secondary)]"
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "rounded-full w-full h-full flex items-center justify-center font-semibold",
            paletteFor(name)
          )}
          style={{ fontSize: Math.max(10, Math.floor(size * 0.38)) }}
          aria-hidden
        >
          {initials(name)}
        </div>
      )}
      {teamFlag && (
        <img
          src={teamFlag}
          alt=""
          className="absolute -bottom-0.5 -right-0.5 rounded-full border border-[color:var(--color-surface-primary)] object-cover bg-[color:var(--color-surface-primary)]"
          style={{
            width: Math.max(14, Math.floor(size * 0.42)),
            height: Math.max(14, Math.floor(size * 0.42)),
          }}
          aria-hidden
          loading="lazy"
        />
      )}
    </div>
  );
}
