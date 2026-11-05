"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import styles from "./RoutesGraph.module.css";

const NODE_H = 56;
const GAP_Y = 24;

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
  const nodeW = Math.min(200, colW - 40);
  const height = layout.maxRows * (NODE_H + GAP_Y) - GAP_Y;
  const pos: Record<string, { x: number; y: number }> = {};
  layout.cols.forEach((col, ci) => {
    const offset = ((layout.maxRows - col.length) * (NODE_H + GAP_Y)) / 2;
    col.forEach((id, ri) => (pos[id] = { x: ci * colW, y: offset + ri * (NODE_H + GAP_Y) }));
  });
  const maxCount = Math.max(1, ...edges.map((e) => e.count));

  return (
    <div ref={ref} className={styles.wrap}>
      <div className={styles.canvas} style={{ height }} aria-hidden="true">
        <svg className={styles.edges} width={width} height={height}>
          {edges.map((e) => {
            const a = pos[e.from];
            const b = pos[e.to];
            if (!a || !b) return null;
            const x1 = a.x + nodeW;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = x1 + (x2 - x1) / 2;
            return <path key={`${e.from}-${e.to}`} className={styles.edge} d={`M${x1} ${y1}H${mx}V${y2}H${x2}`} strokeWidth={1 + (e.count / maxCount) * 7} />;
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
        {edges.map((e) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const mx = a.x + nodeW + (b.x - a.x - nodeW) / 2;
          const my = (a.y + b.y) / 2 + NODE_H / 2;
          return (
            <span key={`c-${e.from}-${e.to}`} className={styles.count} style={{ left: mx, top: my }}>
              {fmtInt(e.count)}
            </span>
          );
        })}
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
