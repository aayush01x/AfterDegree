"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DistributionItem } from "@/lib/types";
import { placeField } from "@/components/art/PlaceArt";
import { useDrill } from "@/components/drill/useDrill";
import { fmtInt } from "@/lib/format";
import { CellDigits } from "./CellDigits";
import { drillOf } from "./Drillable";
import styles from "./PersonStrip.module.css";

export interface PersonStripProps {
  items: DistributionItem[];
  n: number;
  label: string;
  /** Left column copy, e.g. "Each square is one person like you." */
  intro?: ReactNode;
  /** Evidence line under the intro, e.g. "N = 312 · by country". */
  keyLabel?: ReactNode;
  /** Cell pitch in px. */
  cell?: number;
  className?: string;
}

const OTHER = /^(other|others|other countries|elsewhere|unknown)$/i;
const MAX_CELLS = 900;
const LABEL_H = 22;

interface Group {
  item: DistributionItem;
  cells: number;
  start: number;
  end: number;
  color: string;
  hollow: boolean;
}

/** Target first, then by count, "Other" next to last, the remainder (e.g. "Still in India") last. */
function order(items: DistributionItem[]) {
  const rank = (i: DistributionItem) => (i.target ? 0 : i.remainder ? 3 : OTHER.test(i.label.trim()) ? 2 : 1);
  return [...items].filter((i) => i.count > 0).sort((a, b) => rank(a) - rank(b) || b.count - a.count);
}

/**
 * One cell per person, grouped by destination and coloured by place. The row
 * count reflows with the width (fewest rows that fit). Groups with a drill
 * token open it; their labels are the keyboard targets.
 */
export function PersonStrip({ items, n, label, intro, keyLabel, cell = 12, className }: PersonStripProps) {
  const drill = useDrill();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hot, setHot] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = items.reduce((s, i) => s + Math.max(0, i.count), 0);
  const per = total > MAX_CELLS ? Math.ceil(total / MAX_CELLS) : 1;
  const groups: Group[] = useMemo(() => {
    let at = 0;
    return order(items).map((item) => {
      const cells = Math.max(1, Math.round(item.count / per));
      const g = { item, cells, start: at, end: at + cells, color: placeField(item.label), hollow: !!item.remainder };
      at += cells;
      return g;
    });
  }, [items, per]);
  const cellsTotal = groups.length ? groups[groups.length - 1].end : 0;

  const pad = 4;
  const usable = Math.max(0, width - pad * 2);
  let rows = 3;
  while (rows < 24 && Math.ceil(cellsTotal / rows) * cell > usable) rows++;
  const cols = Math.ceil(cellsTotal / Math.max(1, rows));
  const top = pad;
  const W = cols * cell + pad * 2;
  const H = top + rows * cell + 2;

  const pos = (k: number) => [pad + Math.floor(k / rows) * cell, top + (k % rows) * cell] as const;

  // labels under the groups, left to right, never overlapping; the remainder sits at the right end
  const labels: { g: Group; x: number; right?: boolean }[] = [];
  const est = (g: Group) => g.item.label.length * 6.6 + 10 + String(g.item.count).length * 12 + (g.item.target ? 12 : 0);
  const rest = groups.find((g) => g.hollow);
  const restW = rest ? est(rest) : 0;
  let prev = -Infinity;
  for (const g of groups) {
    if (g === rest) continue;
    const x = Math.max(pad + Math.floor(g.start / rows) * cell, prev + 12);
    if (x + est(g) > W - restW - 16) continue;
    labels.push({ g, x });
    prev = x + est(g);
  }
  if (rest) labels.push({ g: rest, x: 0, right: true });

  const clickable = (g: Group) => drill.enabled && !!drillOf(g.item);
  const open = (g: Group) => {
    const t = drillOf(g.item);
    if (t) drill.open(t, g.item.label);
  };

  return (
    <div className={[styles.strip, className].filter(Boolean).join(" ")}>
      <div className={styles.intro}>
        {intro && <p className={styles.lead}>{per > 1 ? `Each square is ${per} people.` : intro}</p>}
        {keyLabel && <p className={styles.key}>{keyLabel}</p>}
      </div>
      <div className={styles.wrap} ref={box}>
        {width > 0 && (
          <div className={styles.canvas} style={{ width: W, height: H + LABEL_H + 4 }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" role="img" aria-label={`${label}: ${groups.map((g) => `${g.item.label} ${fmtInt(g.item.count)}`).join(", ")}`}>
              {groups
                .filter((g) => g.item.target || g.item.label === hot)
                .map((g) => (
                  <g key={`inv-${g.item.label}`} className={styles.inv}>
                    {Array.from({ length: g.cells }, (_, j) => {
                      const [x, y] = pos(g.start + j);
                      return <rect key={j} x={x - 3} y={y - 3} width={cell + 4} height={cell + 4} />;
                    })}
                  </g>
                ))}
              {groups.map((g) => (
                <g
                  key={g.item.label}
                  className={clickable(g) ? styles.hit : undefined}
                  style={g.hollow ? { stroke: g.color, fill: "none" } : { fill: g.color }}
                  onClick={clickable(g) ? () => open(g) : undefined}
                  onMouseEnter={clickable(g) ? () => setHot(g.item.label) : undefined}
                  onMouseLeave={clickable(g) ? () => setHot(null) : undefined}
                >
                  {Array.from({ length: g.cells }, (_, j) => {
                    const [x, y] = pos(g.start + j);
                    return g.hollow ? (
                      <rect key={j} className="ad-assemble" style={{ ["--i" as string]: g.start + j, ["--n" as string]: cellsTotal }} x={x + 0.5} y={y + 0.5} width={cell - 3} height={cell - 3} />
                    ) : (
                      <rect key={j} className="ad-assemble" style={{ ["--i" as string]: g.start + j, ["--n" as string]: cellsTotal }} x={x} y={y} width={cell - 2} height={cell - 2} />
                    );
                  })}
                </g>
              ))}
            </svg>
            {labels.map(({ g, x, right }) => {
              const on = g.item.target || hot === g.item.label;
              const body = (
                <>
                  <span>{g.item.label}</span>
                  <CellDigits value={g.item.count} pitch={2} tone="current" label={fmtInt(g.item.count)} />
                </>
              );
              const style = right ? { right: pad + 2, top: H + 4 } : { left: x, top: H + 4 };
              const cls = [styles.label, on && styles.on].filter(Boolean).join(" ");
              return clickable(g) ? (
                <button
                  key={g.item.label}
                  type="button"
                  className={cls}
                  style={style}
                  onClick={() => open(g)}
                  onFocus={() => setHot(g.item.label)}
                  onBlur={() => setHot(null)}
                  onMouseEnter={() => setHot(g.item.label)}
                  onMouseLeave={() => setHot(null)}
                  aria-label={`${g.item.label}, ${fmtInt(g.item.count)} people: see who`}
                >
                  {body}
                </button>
              ) : (
                <span key={g.item.label} className={cls} style={style}>
                  {body}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <ul className="visually-hidden">
        {groups.map((g) => (
          <li key={g.item.label}>
            {g.item.label}: {fmtInt(g.item.count)} of {fmtInt(n)}
          </li>
        ))}
      </ul>
    </div>
  );
}
