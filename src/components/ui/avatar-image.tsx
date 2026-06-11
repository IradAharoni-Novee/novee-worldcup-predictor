"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

// Renders a remote avatar photo and swaps to `fallback` when the image fails
// to load (404, expired Slack/Google URL, network error). Plain <img> with no
// error handling shows the browser's broken-image icon instead — see the
// leaderboard/header avatars.
export function AvatarImage({
  src,
  alt,
  size,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // An image that finished loading (and failed) before hydration never fires
  // onError, so the handler attached during hydration would miss it. Detect
  // that case directly: a completed image with zero natural width is broken.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return <>{fallback}</>;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-full object-cover", className)}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
