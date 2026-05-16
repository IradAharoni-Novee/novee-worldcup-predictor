"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { CosmicLogo } from "@/components/easter-eggs/cosmic-logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { signOutAction } from "@/lib/actions/sign-out";

type NavLink = { href: string; label: string };

const NAV: readonly NavLink[] = [
  { href: "/matches", label: "Matches" },
  { href: "/groups", label: "Groups" },
  { href: "/bracket", label: "Bracket" },
  { href: "/awards", label: "Awards" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/me", label: "Me" },
];

export function TopBar({
  userEmail,
  userName,
  userImage,
  isAdmin,
}: {
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  return (
    <header className="border-b border-[color:var(--color-border-primary)] bg-[var(--nav-top-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CosmicLogo size={28} />
            <Link href="/" className="heading text-base">
              World Cup Predictor
            </Link>
          </div>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                email={userEmail}
                name={userName}
                image={userImage}
                size={28}
              />
              <div className="flex flex-col leading-tight">
                <span className="body body-size-small body-weight-medium">
                  {userName ?? userEmail.split("@")[0]}
                </span>
                <span className="body body-size-xsmall text-[color:var(--color-text-tertiary)]">
                  {userEmail}
                </span>
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                className="size-8 grid place-items-center rounded-md text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
