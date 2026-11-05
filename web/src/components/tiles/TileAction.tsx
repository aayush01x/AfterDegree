"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { DrillToken } from "@/lib/drill-types";
import { useDrill } from "@/components/drill/useDrill";

/** What a tile does when chosen, in priority order: onSelect, drill, href. */
export interface TileTarget {
  onSelect?: () => void;
  drill?: DrillToken | null;
  drillTitle?: string;
  href?: string;
}

/** True when the tile has something to do on click. */
export function useTileTarget({ onSelect, drill, drillTitle, href }: TileTarget): (() => void) | string | null {
  const d = useDrill();
  if (onSelect) return onSelect;
  if (drill && d.enabled) return () => d.open(drill, drillTitle);
  if (href) return href;
  return null;
}

/** A control that covers its tile (stretched hit area) or sits inline. */
export function TileHit({ target, className, label, children }: { target: (() => void) | string; className?: string; label?: string; children: ReactNode }) {
  if (typeof target === "string")
    return (
      <Link href={target} className={className} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={className} aria-label={label} onClick={target}>
      {children}
    </button>
  );
}
