"use client";

import { useState } from "react";
import type { DistributionItem } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import styles from "./CohortWaffle.module.css";

export interface CohortWaffleProps {
  items: DistributionItem[];
  /** Total people the cells stand for. */
  n: number;
  /** What one cell counts, singular/plural handled for "people". */
  unit?: string;
  /** Controlled selection (a label). Defaults to the `target` item. */
  selected?: string;
  onSelect?: (label: string) => void;
  /** Above this many cells, one cell stands for several people. */
  maxCells?: number;
  legend?: boolean;
  /** Legend text for filled and hollow cells, e.g. "Abroad · 214". */
  filledLabel?: string;
  hollowLabel?: string;
  /** Accessible name for the group of rows. */
  label: string;
}

/**
 * One square cell per person, grouped into rows. The selected row inverts to
 * a black band; remainder rows ("Still in India") draw hollow cells.
 */
export function CohortWaffle({
  items,
  n,
  unit = "people",
  selected,
  onSelect,
  maxCells = 600,
  legend = true,
  filledLabel,
  hollowLabel,
  label,
}: CohortWaffleProps) {
  const target = items.find((i) => i.target)?.label;
  const [inner, setInner] = useState<string | undefined>(target);
  const current = selected ?? inner;
  const perCell = Math.max(1, Math.ceil(n / maxCells));
  const cellsFor = (c: number) => (c <= 0 ? 0 : Math.max(1, Math.round(c / perCell)));
  const total = items.reduce((s, i) => s + cellsFor(i.count), 0);
  const main = items.filter((i) => !i.remainder);
  const rest = items.filter((i) => i.remainder);
  const sel = items.find((i) => i.label === current);
  const one = unit === "people" ? "person" : unit.replace(/s$/, "");

  // Global reading-order index of each row's first cell, so cells assemble top to bottom.
  const ordered = [...main, ...rest];
  const starts = new Map<string, number>();
  ordered.reduce((acc, i) => (starts.set(i.label, acc), acc + cellsFor(i.count)), 0);

  const renderRow = (item: DistributionItem, first: boolean) => {
    const cells = cellsFor(item.count);
    const start = starts.get(item.label) ?? 0;
    const pressed = item.label === current;
    return (
      <li key={item.label} className={[item.remainder && styles.remainder, first && styles.remainderStart].filter(Boolean).join(" ")}>
        <button
          type="button"
          className={styles.row}
          aria-pressed={pressed}
          onClick={() => {
            setInner(item.label);
            onSelect?.(item.label);
          }}
        >
          <span className={styles.label}>
            {item.label}
            {item.target && <span className={styles.tag}>Target</span>}
          </span>
          <span className={[styles.cells, item.remainder && styles.hollow].filter(Boolean).join(" ")} aria-hidden="true">
            {Array.from({ length: cells }, (_, k) => (
              <i key={k} className={`${styles.cell} ad-assemble`} style={{ ["--i" as string]: start + k, ["--n" as string]: total }} />
            ))}
          </span>
          <span className={styles.count}>
            {fmtInt(item.count)}
            <span className="visually-hidden">
              {" "}
              {unit}, {fmtPct(item.count / n)} of {fmtInt(n)}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.waffle}>
      <ul role="list" aria-label={label} className={styles.rows}>
        {main.map((i) => renderRow(i, false))}
        {rest.map((i, k) => renderRow(i, k === 0))}
      </ul>
      {legend && (
        <p className={styles.legend}>
          <span>
            <i aria-hidden="true" />
            {filledLabel ?? (perCell > 1 ? `1 square = ${perCell} ${unit}` : `1 square = 1 ${one}`)}
          </span>
          {rest.length > 0 && (
            <span>
              <i className={styles.keyHollow} aria-hidden="true" />
              {hollowLabel ?? rest.map((r) => `${r.label} · ${fmtInt(r.count)}`).join(", ")}
            </span>
          )}
          {perCell > 1 && filledLabel && <span>1 square = {perCell} {unit}</span>}
          {sel && (
            <span aria-live="polite">
              <i className={styles.keySelected} aria-hidden="true" />
              Selected: <strong>{sel.label}</strong> · {fmtInt(sel.count)} ({fmtPct(sel.count / n)})
            </span>
          )}
        </p>
      )}
    </div>
  );
}
