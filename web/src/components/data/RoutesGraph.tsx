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
  const NODE_H = Math.max(MIN_NODE_H, busiest * PORT_H + 12);
  const height = layout.maxRows * (NODE_H + GAP_Y) - GAP_Y;
  const pos: Record<string, { x: number; y: number }> = {};
  layout.cols.forEach((col, ci) => {
    const offset = ((layout.maxRows - col.length) * (NODE_H + GAP_Y)) / 2;
    col.forEach((id, ri) => (pos[id] = { x: ci * colW, y: offset + ri * (NODE_H + GAP_Y) }));
  });
  const maxCount = Math.max(1, ...edges.map((e) => e.count));

  // Every edge gets its own exit port on the source, entry port on the target and vertical lane in
  // the gutter, so lines and count badges never sit on top of each other.
  const routed = useMemo(() => {
    const ins: Record<string, typeof edges> = {};
    const outs: Record<string, typeof edges> = {};
    const byCol: Record<number, typeof edges> = {};
    for (const e of edges) {
      if (!pos[e.from] || !pos[e.to]) continue;
      (ins[e.to] ??= []).push(e);
      (outs[e.from] ??= []).push(e);
      (byCol[layout.depth[e.to]] ??= []).push(e);
    }
    const yOf = (id: string) => pos[id].y;
    const order = (list: typeof edges, key: (e: (typeof edges)[number]) => number) => [...list].sort((a, b) => key(a) - key(b));
    const port = (list: typeof edges, e: (typeof edges)[number], top: number) => {
      const i = list.indexOf(e);
      return top + (NODE_H * (i + 1)) / (list.length + 1);
    };
    const sortedIns = Object.fromEntries(Object.entries(ins).map(([k, l]) => [k, order(l, (e) => yOf(e.from))]));
    const sortedOuts = Object.fromEntries(Object.entries(outs).map(([k, l]) => [k, order(l, (e) => yOf(e.to))]));
    const lanes = Object.fromEntries(Object.entries(byCol).map(([k, l]) => [k, order(l, (e) => yOf(e.from) * 1000 + yOf(e.to))]));
    return edges.flatMap((e) => {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) return [];
      const lane = lanes[layout.depth[e.to]];
      const gutter = colW - nodeW;
      const li = lane.indexOf(e);
      const mx = b.x - gutter + gutter * 0.2 + (gutter * 0.45 * (li + 1)) / (lane.length + 1);
      return [{ e, x1: a.x + nodeW, y1: port(sortedOuts[e.from], e, a.y), mx, x2: b.x, y2: port(sortedIns[e.to], e, b.y) }];
    });
    // pos/colW/nodeW are recomputed every render from width; edges/layout drive the routing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, layout, width]);

  return (
    <div ref={ref} className={styles.wrap}>
      <div className={styles.canvas} style={{ height }} aria-hidden="true">
        <svg className={styles.edges} width={width} height={height}>
          {routed.map(({ e, x1, y1, mx, x2, y2 }) => (
            <path key={`${e.from}-${e.to}`} className={styles.edge} d={`M${x1} ${y1}H${mx}V${y2}H${x2}`} strokeWidth={1 + (e.count / maxCount) * 5} />
          ))}
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
        {routed.map(({ e, x2, y2 }) => (
          <span key={`c-${e.from}-${e.to}`} className={styles.count} style={{ left: x2 - 4, top: y2 }}>
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
