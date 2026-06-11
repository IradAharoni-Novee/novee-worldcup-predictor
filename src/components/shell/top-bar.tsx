"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync menu state to route change
    setMenuOpen(false);
  }, [pathname]);

  const links = isAdmin
    ? [...NAV, { href: "/admin/matches", label: "Admin" }]
    : NAV;

  function isActive(href: string) {
    if (href === "/admin/matches") return pathname.startsWith("/admin");
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="border-b border-[color:var(--color-border-primary)] bg-[var(--nav-top-bg)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <CosmicLogo size={28} />
            <Link href="/" className="heading text-base truncate">
              <span className="hidden sm:inline">World Cup Predictor</span>
              <span className="sm:hidden">Predictor</span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.href);
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
          </nav>
        </div>
        {userEmail && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/me"
              title="Your profile"
              className="hidden sm:flex items-center gap-2 min-w-0 rounded-md px-1.5 py-1 hover:bg-[var(--tabs-nav-item-bg-hover)] transition-colors"
            >
              <UserAvatar
                email={userEmail}
                name={userName}
                image={userImage}
                size={28}
              />
              <div className="hidden md:flex flex-col leading-tight min-w-0">
                <span className="body body-size-small body-weight-medium truncate">
                  {userName ?? userEmail.split("@")[0]}
                </span>
                <span className="body body-size-xsmall text-[color:var(--color-text-tertiary)] truncate">
                  {userEmail}
                </span>
              </div>
            </Link>
            <form action={signOutAction} className="hidden sm:block">
              <button
                type="submit"
                title="Sign out"
                className="size-8 grid place-items-center rounded-md text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="md:hidden size-9 grid place-items-center rounded-md text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        )}
      </div>
      {menuOpen && userEmail && (
        <div className="md:hidden border-t border-[color:var(--color-border-primary)] bg-[var(--nav-top-bg)]">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-[color:var(--color-border-secondary)]">
              <UserAvatar
                email={userEmail}
                name={userName}
                image={userImage}
                size={36}
              />
              <div className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="body body-size-small body-weight-medium truncate">
                  {userName ?? userEmail.split("@")[0]}
                </span>
                <span className="body body-size-xsmall text-[color:var(--color-text-tertiary)] truncate">
                  {userEmail}
                </span>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Sign out"
                  className="size-9 grid place-items-center rounded-md text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[color:var(--color-text-primary)] transition-colors"
                >
                  <LogOut className="size-4" />
                  <span className="sr-only">Sign out</span>
                </button>
              </form>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-2.5 rounded-md text-base font-medium transition-colors",
                      active
                        ? "bg-[var(--tabs-nav-item-bg-active)] text-[var(--tabs-nav-item-surface-selected)]"
                        : "text-[color:var(--color-text-secondary)] hover:bg-[var(--tabs-nav-item-bg-hover)] hover:text-[var(--tabs-nav-item-surface-hover)]"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
