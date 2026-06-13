"use client";

import { createContext, useContext } from "react";

// The real value is always supplied by <TimeZoneProvider> in the authenticated
// layout from the server-resolved viewer zone. This default only matters for a
// consumer rendered with no provider above it, which shouldn't happen.
const TimeZoneContext = createContext<string>("UTC");

export function TimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: React.ReactNode;
}) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}
