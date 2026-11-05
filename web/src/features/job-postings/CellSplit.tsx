"use client";

import { useState } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import type { DrillToken } from "@/lib/drill-types";
import { useDrill } from "@/components/drill/useDrill";
import styles from "./CellSplit.module.css";

export interface SplitPart {
  label: string;
  count: number;
  /** Opens the people or postings behind this part. */
  drill?: DrillToken | null;
}

const CELLS = 40;
const TONES = ["a", "b", "c"] as const;

/** Largest-remainder rounding so the cells always add up to CELLS. */
function allocate(parts: SplitPart[], total: number): number[] {
  if (total <= 0) return parts.map(() => 0);
  const raw = parts.map((p) => (p.count / total) * CELLS);
  const out = raw.map(Math.floor);
  let left = CELLS - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/**
 * One bar of 40 cells split into parts, with a legend that carries the real counts.
 * A part with a drill token is a button (its cells and its legend row): hovering or
 * focusing either inverts both; pressing opens the drill panel.
 */
export function CellSplit({ parts, total, unit = "postings", label }: { parts: SplitPart[]; total: number; unit?: string; label: string }) {
  const cells = allocate(parts, total);
  const drill = useDrill();
  const [hot, setHot] = useState<number | null>(null);
  let seq = 0;
  const showShare = total >= 10;
  const hover = (i: number) => ({
    onPointerEnter: () => setHot(i),
    onPointerLeave: () => setHot(null),
    onFocus: () => setHot(i),
    onBlur: () => setHot(null),
  });
  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="img" aria-label={label}>
        {parts.map((p, pi) => {
          const group = Array.from({ length: cells[pi] }, (_, i) => (
            <i
              key={`${pi}-${i}`}
              className={`${styles.cell} ${styles[TONES[Math.min(pi, 2)]]} ad-assemble`}
              style={{ ["--i" as string]: seq++, ["--n" as string]: CELLS }}
            />
          ));
          if (!p.drill || cells[pi] === 0) return <span key={pi} className={styles.group} style={{ ["--w" as string]: cells[pi] }}>{group}</span>;
          return (
            <button
              key={pi}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={`${styles.group} ${styles.press} ${hot === pi ? styles.hot : ""}`}
              style={{ ["--w" as string]: cells[pi] }}
              onClick={() => drill.open(p.drill!, p.label)}
              {...hover(pi)}
            >
              {group}
            </button>
          );
        })}
      </div>
      <ul className={styles.legend}>
        {parts.map((p, pi) => {
          const inner = (
            <>
              <i className={`${styles.swatch} ${styles[TONES[Math.min(pi, 2)]]}`} aria-hidden="true" />
              <span className={styles.name}>{p.label}</span>
              <span className={styles.val}>
                {fmtInt(p.count)} {unit}
                {showShare && <span className={styles.share}> ({fmtPct(p.count / total)})</span>}
              </span>
            </>
          );
          return (
            <li key={p.label}>
              {p.drill ? (
                <button
                  type="button"
                  className={`${styles.item} ${styles.itemPress} ${hot === pi ? styles.hot : ""}`}
                  onClick={() => drill.open(p.drill!, p.label)}
                  aria-label={`${p.label}: ${fmtInt(p.count)} ${unit}. See them`}
                  {...hover(pi)}
                >
                  {inner}
                </button>
              ) : (
                <div className={styles.item}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
