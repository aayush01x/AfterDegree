import type { CSSProperties } from "react";
import type { CellGrid, Slot } from "./grid";
import styles from "./CellArt.module.css";

const SLOT_VAR: Record<Slot, string> = {
  sil: "var(--a-sil)",
  ink: "var(--a-ink)",
  light: "var(--a-light)",
  sun: "var(--a-sun)",
  tint: "var(--a-tint)",
  deep: "var(--a-deep)",
  shade: "var(--a-shade)",
  glow: "var(--a-glow)",
  water: "var(--a-water)",
  field: "var(--a-f)",
  path: "var(--route-path)",
  node: "var(--route-node)",
};

export interface CellArtProps {
  grid: CellGrid;
  /** CSS colour of the field, always a token, e.g. "var(--art-de)". */
  field: string;
  /** CSS colour of the silhouette cells on this field. */
  on?: string;
  pitch?: number;
  /** Gap between cells in px (the field shows through). */
  gap?: number;
  label?: string;
  /** Where the art sits in a larger box. */
  align?: "center" | "bottom" | "top";
  /** fill: the frame fills its parent (tile art boxes); inline: it is exactly the art's size. */
  fit?: "fill" | "inline";
  className?: string;
}

/** Renders a CellGrid as flat cells on its field. role="img" unless no label is given. */
export function CellArt({ grid, field, on, pitch = 8, gap = 1, label, align = "center", fit = "fill", className }: CellArtProps) {
  const W = grid.w * pitch;
  const H = grid.h * pitch;
  const groups = new Map<Slot, [number, number][]>();
  grid.cells.forEach((s, k) => {
    const list = groups.get(s) ?? [];
    list.push([k % grid.w, Math.floor(k / grid.w)]);
    groups.set(s, list);
  });
  const size = pitch - gap;
  const style = { "--a-f": field, "--a-on": on ?? "var(--art-ink)" } as CSSProperties;
  return (
    <div className={[styles.frame, styles[align], styles[fit], className].filter(Boolean).join(" ")} style={style} data-art="">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      >
        {[...groups.entries()].map(([slot, pts]) => (
          <g key={slot} style={{ fill: SLOT_VAR[slot] }}>
            {pts.map(([x, y]) => (
              <rect key={`${x}-${y}`} x={x * pitch} y={y * pitch} width={size} height={size} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
