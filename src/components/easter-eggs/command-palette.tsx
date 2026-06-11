"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { NOVEE_VOICE_TUNING } from "@/lib/veevee-voice";
import { veeveeToast } from "@/components/ui/veevee-toast";

type Action =
  | { kind: "navigate"; href: string }
  | { kind: "toast"; message: string };

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  action: Action;
};

function buildItems(isAdmin: boolean): CommandItem[] {
  const base: CommandItem[] = [
    { id: "matches", label: "Go to matches", hint: "/matches", action: { kind: "navigate", href: "/matches" } },
    { id: "groups", label: "Go to groups", hint: "/groups", action: { kind: "navigate", href: "/groups" } },
    { id: "bracket", label: "Go to bracket", hint: "/bracket", action: { kind: "navigate", href: "/bracket" } },
    { id: "awards", label: "Go to awards", hint: "/awards", action: { kind: "navigate", href: "/awards" } },
    { id: "leaderboard", label: "Go to leaderboard", hint: "/leaderboard", action: { kind: "navigate", href: "/leaderboard" } },
    { id: "me", label: "Go to my predictions", hint: "/me", action: { kind: "navigate", href: "/me" } },
    {
      id: "resign",
      label: "Submit résumé to XBOW",
      hint: "VeeVee suggests",
      action: { kind: "toast", message: "Sent. Good luck." },
    },
  ];
  for (const [i, moment] of NOVEE_VOICE_TUNING.moment.entries()) {
    base.push({
      id: `moment-${i}`,
      label: moment,
      hint: "Never forget",
      action: { kind: "toast", message: "VeeVee remembers." },
    });
  }
  if (isAdmin) {
    base.unshift({
      id: "admin",
      label: "Go to admin",
      hint: "/admin",
      action: { kind: "navigate", href: "/admin/matches" },
    });
  }
  return base;
}

/**
 * Global Cmd+K (Ctrl+K on non-Mac) command palette. Filters by substring,
 * supports arrow keys and Enter, and includes a joke entry alongside the real
 * navigation shortcuts.
 */
export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items = useMemo(() => buildItems(isAdmin), [isAdmin]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOpenCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isOpenCombo) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset palette state on close
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset highlight when query changes
    setActiveIndex(0);
  }, [query]);

  function runAction(item: CommandItem) {
    setOpen(false);
    if (item.action.kind === "navigate") {
      router.push(item.action.href);
    } else {
      veeveeToast(item.action.message);
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) runAction(item);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-xl gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Type to filter VeeVee&apos;s shortcuts. Arrow keys to navigate, Enter
          to run.
        </DialogDescription>
        <input
          ref={inputRef}
          type="text"
          placeholder="What does VeeVee see for you today…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          className="w-full px-4 py-3 bg-transparent border-b border-[color:var(--color-border-secondary)] outline-none body body-size-medium"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 body body-size-small text-[color:var(--color-text-tertiary)]">
              No commands. VeeVee shrugs.
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => runAction(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2 text-left",
                    idx === activeIndex
                      ? "bg-[color:var(--color-category-bg-brand)]/40"
                      : "hover:bg-[color:var(--color-surface-hover)]"
                  )}
                >
                  <span className="body body-size-medium">{item.label}</span>
                  {item.hint && (
                    <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                      {item.hint}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
