"use client";
// Public drill-down API used by every view. The DrillProvider (DrillProvider.tsx) implements it.
import { createContext, useContext } from "react";
import type { DrillToken } from "@/lib/drill-types";

export interface DrillApi {
  /** Open the drill panel for a token (from engine output). `label` is the human title, e.g. "Germany". */
  open: (token: DrillToken, label?: string) => void;
  /** Open a person's anonymous career timeline directly. */
  openPerson: (personId: string) => void;
  /** True when a DrillProvider is mounted. */
  enabled: boolean;
}

export const DrillContext = createContext<DrillApi>({
  open: () => {},
  openPerson: () => {},
  enabled: false,
});

export function useDrill(): DrillApi {
  return useContext(DrillContext);
}
