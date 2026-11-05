"use client";
// Implements the public drill API (useDrill.ts) with URL navigation, so every drill level is a
// shareable page and the back button walks back up the drill.
import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { DrillToken } from "@/lib/drill-types";
import { DrillContext, type DrillApi } from "./useDrill";
import { decodeToken, encodeToken, personHref } from "./token";

/** The drill token of the page we are on: `?d=` on /explore, `?from=` on /people/<id>. */
export function currentDrillToken(): DrillToken | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  if (window.location.pathname.startsWith("/explore")) return decodeToken(q.get("d"));
  if (window.location.pathname.startsWith("/people/")) return decodeToken(q.get("from"));
  return null;
}

export function DrillProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const value = useMemo<DrillApi>(
    () => ({
      enabled: true,
      open: (token, label) => {
        const q = new URLSearchParams({ d: encodeToken(token) });
        // Without a path step the page has no title of its own; carry the caller's label.
        if (label && token.path.length === 0) q.set("l", label);
        router.push(`/explore?${q.toString()}`);
      },
      openPerson: (personId) => router.push(personHref(personId, currentDrillToken())),
    }),
    [router],
  );
  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
}
