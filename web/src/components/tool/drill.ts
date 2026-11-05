// Helpers the four tool screens share for drill tokens (docs/CONTRACT.md Appendix C).
import type { KeyboardEvent } from "react";
import type { DrillDimension, DrillToken } from "@/lib/drill-types";

export { drillOf } from "@/components/data/Drillable";

/** Attach a token to an item (used by mock data, never by views). */
export function withDrill<T extends object>(item: T, token: DrillToken | null | undefined): T {
  return token ? ({ ...item, drill: token } as T) : item;
}

/** Build a one-step token from the origin tool's params (mock data). */
export function mkDrill(tool: string, params: Record<string, unknown>, dimension: DrillDimension, value: string, label = value): DrillToken {
  return { tool, params, path: [{ dimension, value, label }] };
}

/** Props that make a non-button element act like a button for mouse and keyboard. */
export function pressable(onOpen: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
}
