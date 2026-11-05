"use client";

import { CellDigits } from "@/components/data/CellDigits";
import { countryKey } from "./places";
import { hashString, rng } from "./grid";
import styles from "./CountryMap.module.css";

export interface MapMarker {
  label: string;
  count: number;
  selected?: boolean;
  onSelect?: () => void;
  /** False when too few people to list (count only). */
  listable?: boolean;
}

export interface CountryMapProps {
  country: string;
  markers?: MapMarker[];
  /** Cell pitch in px. */
  cell?: number;
  label?: string;
  className?: string;
}

/* Germany as cell spans per row (from the approved drill mockup), 18 x 22 cells. */
const DE_SPANS: Record<number, [number, number][]> = {
  0: [[5, 6]], 1: [[5, 8], [10, 10], [14, 15]], 2: [[5, 9], [12, 16]], 3: [[5, 16]], 4: [[2, 16]], 5: [[2, 16]],
  6: [[2, 17]], 7: [[1, 17]], 8: [[1, 17]], 9: [[0, 17]], 10: [[0, 17]], 11: [[0, 17]], 12: [[0, 15]],
  13: [[0, 13]], 14: [[1, 12]], 15: [[1, 13]], 16: [[2, 14]], 17: [[4, 15]], 18: [[3, 14]],
  19: [[3, 13]], 20: [[3, 14]], 21: [[8, 14]],
};
const DE_TRIM = new Set(["2,16", "12,15", "13,13", "20,14"]);
/** [row, col] of German cities on that grid. */
const DE_CITIES: Record<string, [number, number]> = {
  berlin: [7, 14], potsdam: [8, 13], hamburg: [4, 8], kiel: [1, 8], bremen: [5, 5], hanover: [7, 8], hannover: [7, 8],
  cologne: [11, 2], köln: [11, 2], bonn: [12, 2], düsseldorf: [10, 2], dusseldorf: [10, 2], aachen: [12, 0], dortmund: [9, 3], essen: [10, 3],
  frankfurt: [14, 5], darmstadt: [15, 6], mannheim: [15, 4], walldorf: [16, 5], heidelberg: [16, 6], karlsruhe: [17, 4], stuttgart: [17, 7],
  nuremberg: [16, 11], nürnberg: [16, 11], erlangen: [15, 11], munich: [19, 11], münchen: [19, 11], ingolstadt: [18, 11], augsburg: [19, 9],
  leipzig: [10, 12], dresden: [11, 15], jena: [12, 11], magdeburg: [8, 11], wolfsburg: [7, 10], freiburg: [20, 3], ulm: [19, 7], regensburg: [17, 13],
};

function germanyLand(): { cols: number; rows: number; land: Set<string> } {
  const land = new Set<string>();
  for (const [r, spans] of Object.entries(DE_SPANS))
    for (const [a, b] of spans) for (let c = a; c <= b; c++) if (!DE_TRIM.has(`${r},${c}`)) land.add(`${r},${c}`);
  return { cols: 18, rows: 22, land };
}

function genericLand(name: string): { cols: number; rows: number; land: Set<string> } {
  const r = rng(hashString(name));
  const cols = 18, rows = 16;
  const land = new Set<string>();
  let lo = 6, hi = 11;
  for (let row = 1; row < rows - 1; row++) {
    const t = row / (rows - 1);
    const half = Math.round(Math.sin(Math.PI * t) * 8);
    lo = Math.max(0, Math.min(lo + Math.round(r() * 2 - 1), 9 - Math.floor(half / 2)));
    hi = Math.min(cols - 1, Math.max(hi + Math.round(r() * 2 - 1), 8 + Math.floor(half / 2)));
    const a = Math.max(0, 9 - half + Math.round(r() * 2 - 1));
    const b = Math.min(cols - 1, 8 + half + Math.round(r() * 2 - 1));
    for (let c = Math.min(a, lo); c <= Math.max(b, hi) && c <= b + 1; c++) if (c >= a) land.add(`${row},${c}`);
  }
  return { cols, rows, land };
}

function place(label: string, land: Set<string>, known: Record<string, [number, number]> | null): [number, number] | null {
  const k = label.trim().toLowerCase().split(/[ ,(]/)[0];
  if (known && known[k]) return known[k];
  if (known) return null;
  const cells = [...land].map((s) => s.split(",").map(Number) as [number, number]);
  if (!cells.length) return null;
  return cells[hashString(k) % cells.length];
}

function markerSize(count: number, max: number, cell: number) {
  const t = max > 0 ? count / max : 0;
  return t > 0.66 ? cell * 2.5 : t > 0.33 ? cell * 2 : cell * 1.5;
}

/** A country drawn as grid cells, with count markers placed by city name. */
export function CountryMap({ country, markers = [], cell = 16, label, className }: CountryMapProps) {
  const de = countryKey(country) === "de";
  const { cols, rows, land } = de ? germanyLand() : genericLand(country);
  const W = cols * cell, H = rows * cell;
  const max = Math.max(0, ...markers.map((m) => m.count));
  const placed = markers
    .map((m) => ({ m, at: place(m.label, land, de ? DE_CITIES : null) }))
    .filter((p): p is { m: MapMarker; at: [number, number] } => !!p.at);
  return (
    <div className={["ad-dots", styles.map, className].filter(Boolean).join(" ")} style={{ width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? `Map of ${country} built from grid cells`} shapeRendering="crispEdges">
        <g className={styles.land}>
          {[...land].map((k) => {
            const [r, c] = k.split(",").map(Number);
            return <rect key={k} x={c * cell + 1} y={r * cell + 1} width={cell - 2} height={cell - 2} />;
          })}
        </g>
      </svg>
      {placed.map(({ m, at: [r, c] }) => {
        const size = markerSize(m.count, max, cell);
        const left = c * cell + cell / 2 - size / 2;
        const top = r * cell + cell / 2 - size / 2;
        const body = (
          <>
            <CellDigits value={m.count} font="3x5" pitch={size >= cell * 2.5 ? 4 : 3} tone="current" label={`${m.count}`} />
            <span className={styles.tag}>{m.label}</span>
          </>
        );
        const cls = [styles.marker, m.selected && styles.on, c > cols * 0.6 && styles.tagLeft].filter(Boolean).join(" ");
        return m.onSelect ? (
          <button
            key={m.label}
            type="button"
            className={cls}
            style={{ left, top, width: size, height: size }}
            aria-pressed={!!m.selected}
            aria-label={`${m.label}, ${m.count} ${m.count === 1 ? "person" : "people"}`}
            onClick={m.onSelect}
          >
            {body}
          </button>
        ) : (
          <span key={m.label} className={cls} style={{ left, top, width: size, height: size }}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
