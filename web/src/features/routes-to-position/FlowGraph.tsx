"use client";

import { useMemo, useState } from "react";
import type { RouteEdge, RouteNode, RoutesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { GridNumber } from "@/components/data/GridNumber";
import { useDrill } from "@/components/drill/useDrill";
import { drillOf } from "@/components/data/Drillable";
import { pressable } from "@/components/tool/drill";
import styles from "./FlowGraph.module.css";

/**
 * The signature visual: feeder employers -> previous titles -> the position,
 * laid out on the grid with orthogonal connectors only. Only the lines of the
 * active block are drawn (hover or focus a block to follow its lines), so the
 * picture never tangles. A block with a drill token opens the people behind it.
 */

const BLOCK = 40;
const GAP = 8;
const PITCH = BLOCK + GAP;
const MIN_H = 336;

interface Laid {
  node: RouteNode;
  layer: number;
  count: number;
  y: number;
  h: number;
  big: boolean;
}

const COLUMN_HEAD: Record<string, string> = {
  employer: "Employer just before",
  title: "Title just before",
  goal: "The position",
};

function plural(n: number) {
  return n === 1 ? "person" : "people";
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function weight(count: number, max: number) {
  const r = max > 0 ? count / max : 0;
  return r >= 0.5 ? 6 : r >= 0.25 ? 4 : r >= 0.1 ? 3 : r >= 0.04 ? 2 : 1;
}

function spread(k: number, i: number, step: number) {
  return Math.round((i - (k - 1) / 2) * step);
}

function build(data: RoutesData) {
  const nodes = data.nodes;
  const known = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to && e.count > 0);

  // layer = longest path from a source, with a guard against cycles
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const next = Math.min((layer.get(e.from) ?? 0) + 1, 4);
      if (next > (layer.get(e.to) ?? 0)) {
        layer.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  let last = Math.max(0, ...layer.values());
  for (const n of nodes) if (n.kind === "goal") layer.set(n.id, last);
  last = Math.max(0, ...layer.values());

  const outs = new Map<string, RouteEdge[]>();
  const ins = new Map<string, RouteEdge[]>();
  for (const e of edges) {
    outs.set(e.from, [...(outs.get(e.from) ?? []), e]);
    ins.set(e.to, [...(ins.get(e.to) ?? []), e]);
  }
  const sum = (xs: RouteEdge[] = []) => xs.reduce((s, e) => s + e.count, 0);
  const countOf = (id: string) => sum(outs.get(id)) || sum(ins.get(id));

  const columns: RouteNode[][] = Array.from({ length: last + 1 }, () => []);
  for (const n of nodes) columns[layer.get(n.id) ?? 0].push(n);

  const tallest = Math.max(...columns.map((c) => c.length));
  const H = Math.max(MIN_H, tallest * PITCH - GAP);

  const laid = new Map<string, Laid>();
  columns.forEach((col, li) => {
    const monumental = li === last && col.length === 1;
    const total = col.length * PITCH - GAP;
    const top = Math.round((H - total) / 2);
    col.forEach((node, i) => {
      laid.set(node.id, {
        node,
        layer: li,
        count: countOf(node.id),
        y: monumental ? 0 : top + i * PITCH,
        h: monumental ? H : BLOCK,
        big: monumental,
      });
    });
  });

  const centre = (id: string) => (laid.get(id)!.y + laid.get(id)!.h / 2);

  // edge endpoints, spread inside blocks so lines do not pile up
  const endpoints = new Map<RouteEdge, { y1: number; y2: number }>();
  for (const n of nodes) {
    const o = [...(outs.get(n.id) ?? [])].sort((a, b) => centre(a.to) - centre(b.to));
    const L = laid.get(n.id)!;
    const stepO = o.length > 1 ? Math.min(L.big ? 24 : 4, (L.h - (L.big ? 48 : 12)) / (o.length - 1)) : 0;
    o.forEach((e, i) => {
      endpoints.set(e, { ...(endpoints.get(e) ?? { y1: 0, y2: 0 }), y1: Math.round(centre(n.id)) + spread(o.length, i, stepO) });
    });
    const inc = [...(ins.get(n.id) ?? [])].sort((a, b) => centre(a.from) - centre(b.from));
    const stepI = inc.length > 1 ? Math.min(L.big ? 24 : 4, (L.h - (L.big ? 48 : 12)) / (inc.length - 1)) : 0;
    inc.forEach((e, i) => {
      endpoints.set(e, { ...(endpoints.get(e) ?? { y1: 0, y2: 0 }), y2: Math.round(centre(n.id)) + spread(inc.length, i, stepI) });
    });
  }

  // bus x (in 0..100 units) per source node, staggered so verticals do not overlap
  const bus = new Map<string, number>();
  for (let li = 0; li < last; li++) {
    const sources = columns[li].filter((n) => (outs.get(n.id) ?? []).some((e) => layer.get(e.to) === li + 1));
    sources.sort((a, b) => centre(a.id) - centre(b.id));
    sources.forEach((n, i) => bus.set(n.id, sources.length === 1 ? 50 : Math.round(14 + (i / (sources.length - 1)) * 72)));
  }

  const maxEdge = Math.max(1, ...edges.map((e) => e.count));
  return { columns, laid, edges, outs, ins, endpoints, bus, H, last, maxEdge };
}

function related(id: string, edges: RouteEdge[]) {
  const up = new Set<string>([id]);
  const down = new Set<string>([id]);
  for (let pass = 0; pass < 6; pass++) {
    for (const e of edges) {
      if (up.has(e.to)) up.add(e.from);
      if (down.has(e.from)) down.add(e.to);
    }
  }
  return { up, down };
}

const isRest = (n: RouteNode) => /^other\b|fewer than/i.test(n.label);

export function FlowGraph({ data, label }: { data: RoutesData; label: string }) {
  const g = useMemo(() => build(data), [data]);
  const drill = useDrill();
  // The widest title is followed by default; hovering or focusing a block follows that block instead.
  const first = useMemo(() => {
    const mids = g.columns.flat().filter((n) => g.laid.get(n.id)!.layer > 0 && g.laid.get(n.id)!.layer < g.last && !isRest(n));
    mids.sort((a, b) => g.laid.get(b.id)!.count - g.laid.get(a.id)!.count);
    return mids[0]?.id ?? null;
  }, [g]);
  const [picked, setPicked] = useState<string | null>(null);
  const [goalOn, setGoalOn] = useState(false);
  const selected = picked && g.laid.has(picked) ? picked : first;

  const rel = useMemo(() => (selected ? related(selected, g.edges) : null), [selected, g.edges]);
  // Only the active block's bundle is drawn. With nothing active, only the lines into the position are.
  const edgeOn = (e: RouteEdge) =>
    rel ? (rel.up.has(e.from) && rel.up.has(e.to)) || (rel.down.has(e.from) && rel.down.has(e.to)) : g.laid.get(e.to)!.layer === g.last;
  const nodeOn = (id: string) => !!rel && (rel.up.has(id) || rel.down.has(id));

  const labelOf = (id: string) => g.laid.get(id)?.node.label ?? id;
  const status = (() => {
    if (!selected) return "Hover or focus an employer or a title to follow its lines to the position.";
    const L = g.laid.get(selected);
    if (!L) return "";
    const fmt = (es: RouteEdge[], pick: "from" | "to") =>
      list([...es].sort((a, b) => b.count - a.count).slice(0, 3).map((e) => `${labelOf(e[pick])} (${fmtInt(e.count)})`));
    const parts = [`${L.node.label}: ${fmtInt(L.count)} ${plural(L.count)}.`];
    const i = g.ins.get(selected);
    const o = g.outs.get(selected);
    if (i?.length) parts.push(`Came from ${fmt(i, "from")}.`);
    if (o?.length) parts.push(`Went on to ${fmt(o, "to")}.`);
    if (drillOf(L.node)) parts.push("Press to see the people.");
    return parts.join(" ");
  })();

  const open = (node: RouteNode) => {
    const tok = drillOf(node);
    if (tok) drill.open(tok, node.label);
    else setPicked(node.id);
  };

  const template = g.columns
    .map((_, i) => (i === g.last ? "minmax(0,1.25fr)" : "minmax(0,1fr)") + (i < g.last ? " minmax(40px,0.45fr)" : ""))
    .join(" ");

  return (
    <div className={styles.flow} role="group" aria-label={label}>
      <div className={styles.cols} style={{ gridTemplateColumns: template, ["--flow-h" as string]: `${g.H}px` }}>
        {g.columns.map((col, li) => {
          const kind = col[0]?.kind ?? "";
          return [
            <div key={`c${li}`} className={`${styles.col} ${li === g.last ? styles.colLast : ""}`}>
              <h3 className={styles.colHead}>{COLUMN_HEAD[kind] ?? "Step"}</h3>
              <div className={styles.body}>
                {col.map((node) => {
                  const L = g.laid.get(node.id)!;
                  const style = { ["--y" as string]: `${L.y}px`, ["--h" as string]: `${L.h}px` };
                  if (L.big) {
                    const cut = node.label.split(/\s*[,·]\s*/);
                    const tok = drillOf(node);
                    const body = (
                      <>
                        <p className={styles.goalTitle}>
                          {cut[0]}
                          {cut.length > 1 && <span className={styles.goalPlace}>{cut.slice(1).join(", ")}</span>}
                        </p>
                        <p className={styles.goalCount}>
                          <GridNumber value={L.count} cell={String(L.count).length > 3 ? 8 : 12} gap={2} tone={goalOn && tok ? "ink" : "paper"} label={`${fmtInt(L.count)}`} />
                          <span>{plural(L.count)} we can see in this position</span>
                          {tok && <span className={styles.goalGo}>See the {fmtInt(L.count)} {plural(L.count)}</span>}
                        </p>
                      </>
                    );
                    return tok ? (
                      <div
                        key={node.id}
                        className={`${styles.goal} ${styles.goalButton}`}
                        style={style}
                        aria-label={`${cut[0]}${cut[1] ? `, ${cut.slice(1).join(", ")}` : ""}: ${fmtInt(L.count)} ${plural(L.count)}. See the people`}
                        onMouseEnter={() => setGoalOn(true)}
                        onMouseLeave={() => setGoalOn(false)}
                        onFocus={() => setGoalOn(true)}
                        onBlur={() => setGoalOn(false)}
                        {...pressable(() => open(node))}
                      >
                        {body}
                      </div>
                    ) : (
                      <div key={node.id} className={styles.goal} style={style}>
                        {body}
                      </div>
                    );
                  }
                  const on = selected === node.id;
                  const tok = drillOf(node);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`${styles.block} ad-assemble ${on ? styles.on : ""} ${nodeOn(node.id) && !on ? styles.rel : ""} ${isRest(node) ? styles.rest : ""}`}
                      style={{ ...style, ["--i" as string]: li * 8 + col.indexOf(node), ["--n" as string]: 40 }}
                      aria-pressed={tok ? undefined : on}
                      aria-label={`${node.label}, ${fmtInt(L.count)} ${plural(L.count)}${tok ? ". See the people" : ""}`}
                      onPointerEnter={() => setPicked(node.id)}
                      onFocus={() => setPicked(node.id)}
                      onClick={() => open(node)}
                      title={node.label}
                    >
                      <span className={styles.name}>{node.label}</span>
                      <span className={styles.num}>{fmtInt(L.count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            li < g.last && (
              <div key={`k${li}`} className={styles.conn} aria-hidden="true">
                <div className={styles.colHead} />
                <svg className={styles.svg} viewBox={`0 0 100 ${g.H}`} preserveAspectRatio="none" height={g.H}>
                  {g.edges
                    .filter((e) => g.laid.get(e.from)!.layer === li && g.laid.get(e.to)!.layer === li + 1 && edgeOn(e))
                    .map((e) => {
                      const p = g.endpoints.get(e)!;
                      const bx = g.bus.get(e.from) ?? 50;
                      const d = p.y1 === p.y2 ? `M0 ${p.y1}H100` : `M0 ${p.y1}H${bx}V${p.y2}H100`;
                      return (
                        <path
                          key={`${e.from}-${e.to}`}
                          d={d}
                          className={styles.lineOn}
                          strokeWidth={weight(e.count, g.maxEdge)}
                        />
                      );
                    })}
                </svg>
              </div>
            ),
          ];
        })}
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
