"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import styles from "./RoutesGraph.module.css";

const MIN_NODE_H = 56;
const GAP_Y = 24;
/** Vertical room per count badge where several edges enter one node. */
const PORT_H = 22;

/** Layered step graph: columns by depth, orthogonal edges weighted by count. */
export function RoutesGraph({ data }: { data: RoutesData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  /** Edge under the pointer: it stays dark, the rest fade, so one route can be traced. */
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo(() => data.nodes ?? [], [data.nodes]);
  const edges = useMemo(() => data.edges ?? [], [data.edges]);
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  const layout = useMemo(() => {
    const depth: Record<string, number> = {};
    nodes.forEach((n) => (depth[n.id] = 0));
    for (let pass = 0; pass < nodes.length; pass++) {
      for (const e of edges) if (depth[e.to] !== undefined && depth[e.from] !== undefined) depth[e.to] = Math.max(depth[e.to], depth[e.from] + 1);
    }
    const flow = (id: string) => edges.filter((e) => e.from === id || e.to === id).reduce((s, e) => s + e.count, 0);
    const cols: string[][] = [];
    nodes.forEach((n) => (cols[depth[n.id]] ??= []).push(n.id));
    cols.forEach((c) => c.sort((a, b) => flow(b) - flow(a)));
    const maxRows = Math.max(1, ...cols.map((c) => c.length));
    return { depth, cols, maxRows };
  }, [nodes, edges]);

  const D = Math.max(1, layout.cols.length);
  const colW = width / D;
  const nodeW = Math.min(200, colW - 56);
  const busiest = Math.max(
    1,
    ...nodes.map((n) => Math.max(edges.filter((e) => e.to === n.id).length, edges.filter((e) => e.from === n.id).length)),
  );
  // Tall enough for the longest label (about 7.5px per character at this size, 16px lines) plus the kind line.
  const textLines = Math.max(1, ...nodes.map((n) => Math.ceil((n.label.length * 7.5) / Math.max(60, nodeW - 20))));
  const NODE_H = Math.max(MIN_NODE_H, busiest * PORT_H + 12, textLines * 16 + 14 + 14);
  const rowsHeight = layout.maxRows * (NODE_H + GAP_Y) - GAP_Y;
  // Edges that skip a column run in a channel under the boxes instead of behind them.
  const skips = edges
    .filter((e) => (layout.depth[e.to] ?? 0) - (layout.depth[e.from] ?? 0) > 1)
    .sort((a, b) => layout.depth[a.to] - layout.depth[a.from] - (layout.depth[b.to] - layout.depth[b.from]));
  const CHANNEL_GAP = 14;
  const height = rowsHeight + (skips.length ? 10 + skips.length * CHANNEL_GAP : 0);
  const pos: Record<string, { x: number; y: number }> = {};
  layout.cols.forEach((col, ci) => {
    const offset = ((layout.maxRows - col.length) * (NODE_H + GAP_Y)) / 2;
    col.forEach((id, ri) => (pos[id] = { x: ci * colW, y: offset + ri * (NODE_H + GAP_Y) }));
  });
  const maxCount = Math.max(1, ...edges.map((e) => e.count));

  // Every edge gets its own exit port on the source and entry port on the target, and is drawn as
  // its own curve, so you can follow each connection and its count badge sits at its own entry.
  const routed = useMemo(() => {
    const ins: Record<string, typeof edges> = {};
    const outs: Record<string, typeof edges> = {};
    for (const e of edges) {
      if (!pos[e.from] || !pos[e.to]) continue;
      (ins[e.to] ??= []).push(e);
      (outs[e.from] ??= []).push(e);
    }
    const yOf = (id: string) => pos[id].y;
    const order = (list: typeof edges, key: (e: (typeof edges)[number]) => number) => [...list].sort((a, b) => key(a) - key(b));
    const port = (list: typeof edges, e: (typeof edges)[number], top: number) => {
      const i = list.indexOf(e);
      return top + (NODE_H * (i + 1)) / (list.length + 1);
    };
    const sortedIns = Object.fromEntries(Object.entries(ins).map(([k, l]) => [k, order(l, (e) => yOf(e.from))]));
    const sortedOuts = Object.fromEntries(Object.entries(outs).map(([k, l]) => [k, order(l, (e) => yOf(e.to))]));
    return edges.flatMap((e) => {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) return [];
      const x1 = a.x + nodeW;
      const y1 = port(sortedOuts[e.from], e, a.y);
      const x2 = b.x;
      const y2 = port(sortedIns[e.to], e, b.y);
      // Short straight stubs at both ends, an S-curve across the gap between them.
      const stub = Math.min(10, (x2 - x1) / 6);
      const sx = x1 + stub;
      const ex = x2 - stub - 6;
      const si = skips.indexOf(e);
      let d: string;
      if (si >= 0) {
        // Down into the channel in the gap after the source, along under the boxes, up in the gap before the target.
        const yc = rowsHeight + 10 + si * CHANNEL_GAP;
        const gap = colW - nodeW;
        const downEnd = x1 + gap - stub;
        const upStart = x2 - gap + stub;
        const db = (downEnd - sx) / 2;
        const ub = (ex - upStart) / 2;
        d = `M${x1} ${y1}H${sx}C${sx + db} ${y1} ${downEnd - db} ${yc} ${downEnd} ${yc}H${upStart}C${upStart + ub} ${yc} ${ex - ub} ${y2} ${ex} ${y2}H${x2}`;
      } else {
        const bend = (ex - sx) / 2;
        d = `M${x1} ${y1}H${sx}C${sx + bend} ${y1} ${ex - bend} ${y2} ${ex} ${y2}H${x2}`;
      }
      return [{ e, key: `${e.from}-${e.to}`, d, x2, y2 }];
    });
    // pos/colW/nodeW are recomputed every render from width; edges/layout drive the routing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, layout, width]);

  return (
    <div ref={ref} className={styles.wrap}>
      <div className={styles.canvas} style={{ height }} aria-hidden="true">
        <svg className={styles.edges} width={width} height={height}>
          {routed.map(({ e, key, d }) => {
            const w = 1.5 + (e.count / maxCount) * 3.5;
            const state = active === null ? "" : active === key ? styles.on : styles.dim;
            return (
              <g key={key} className={state} onMouseEnter={() => setActive(key)} onMouseLeave={() => setActive(null)}>
                <path className={styles.halo} d={d} strokeWidth={w + 5} />
                <path className={styles.edge} d={d} strokeWidth={w} />
                <path className={styles.hit} d={d} strokeWidth={14} />
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          return (
            <div key={n.id} className={[styles.node, styles[n.kind]].filter(Boolean).join(" ")} style={{ left: p.x, top: p.y, width: nodeW, height: NODE_H }}>
              {n.label}
              <span className={styles.kind}>{n.kind}</span>
            </div>
          );
        })}
        {routed.map(({ e, key, x2, y2 }) => (
          <span
            key={`c-${key}`}
            className={[styles.count, active === null ? "" : active === key ? styles.on : styles.dim].join(" ")}
            style={{ left: x2 - 4, top: y2 }}
            title={`${fmtInt(e.count)} people: ${label(e.from)} → ${label(e.to)}`}
            onMouseEnter={() => setActive(key)}
            onMouseLeave={() => setActive(null)}
          >
            {fmtInt(e.count)}
          </span>
        ))}
      </div>
      <div className={styles.fallback} aria-hidden="true">
        <ol>
          {edges.map((e) => (
            <li key={`l-${e.from}-${e.to}`}>
              <span>
                {label(e.from)} → {label(e.to)}
              </span>
              <strong>{fmtInt(e.count)}</strong>
            </li>
          ))}
        </ol>
      </div>
      <ul className="visually-hidden">
        {edges.map((e) => (
          <li key={`a-${e.from}-${e.to}`}>
            {fmtInt(e.count)} people went from {label(e.from)} to {label(e.to)}
          </li>
        ))}
      </ul>
    </div>
  );
}
