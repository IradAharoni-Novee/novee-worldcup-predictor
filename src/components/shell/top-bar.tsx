"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { VeeVeeLogo } from "@/components/ui/novee-logo";

type NavLink = { href: string; label: string };

const NAV: readonly NavLink[] = [
  { href: "/matches", label: "Matches" },
  { href: "/bracket", label: "Bracket" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/me", label: "Me" },
];

export function TopBar({
  userEmail,
  isAdmin,
}: {
  userEmail?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  return (
    <header className="border-b border-[color:var(--color-border-primary)] bg-[var(--nav-top-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/matches" className="flex items-center gap-2">
            <VeeVeeLogo size={28} />
            <span className="heading text-base">World Cup Predictor</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--tabs-nav-item-bg-active)] text-[var(--tabs-nav-item-surface-selected)]"
                      : "text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[var(--tabs-nav-item-surface-hover)]"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin/matches"
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-[var(--tabs-nav-item-bg-active)] text-[var(--tabs-nav-item-surface-selected)]"
                    : "text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)]"
                )}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        {userEmail && (
          <span className="body body-size-small text-[color:var(--color-text-secondary)]">
            {userEmail}
          </span>
        )}
      </div>
    </header>
  );
}
