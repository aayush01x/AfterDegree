"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { DrillToken } from "@/lib/drill-types";
import { useDrill } from "@/components/drill/useDrill";
import styles from "./Drillable.module.css";

/** Reads an optional engine `drill` token off any row, item, route or node. */
export function drillOf(x: unknown): DrillToken | undefined {
  if (!x || typeof x !== "object") return undefined;
  const d = (x as { drill?: unknown }).drill;
  if (!d || typeof d !== "object") return undefined;
  const t = d as DrillToken;
  return typeof t.tool === "string" && Array.isArray(t.path) ? t : undefined;
}

export interface DrillableProps {
  token?: DrillToken | null;
  /** Human title for the drill, e.g. "Germany". Also the accessible name prefix. */
  label: string;
  as?: "div" | "li" | "tr" | "span";
  className?: string;
  /** Class added when the element is clickable. */
  activeClassName?: string;
  /** Accessible description of what opens, e.g. "See the 71 people in Germany". */
  actionLabel?: string;
  children: ReactNode;
}

/**
 * Wraps anything that can be drilled. With a token (and a mounted DrillProvider)
 * it is a keyboard-operable button that inverts on hover/focus; otherwise it
 * renders plainly.
 */
export function Drillable({ token, label, as: Tag = "div", className, activeClassName, actionLabel, children }: DrillableProps) {
  const drill = useDrill();
  const live = !!token && drill.enabled;
  if (!live) return <Tag className={className}>{children}</Tag>;
  const open = () => drill.open(token!, label);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  return (
    <Tag
      className={[className, styles.drill, activeClassName].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={actionLabel ?? `${label}: see who this is`}
      onClick={open}
      onKeyDown={onKey}
    >
      {children}
    </Tag>
  );
}
