"use client";

import { ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Scrolls past the run of finished matches to the first upcoming/live match,
// which the page marks with id="recent-matches". Rendered only when there are
// finished matches to skip, so the target is always present.
export function JumpToRecent() {
  function handleClick() {
    document
      .getElementById("recent-matches")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="sticky top-2 z-10 flex justify-center pb-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleClick}
        className="shadow-md"
      >
        <ChevronsDown className="size-4" />
        Jump to recent matches
      </Button>
    </div>
  );
}
