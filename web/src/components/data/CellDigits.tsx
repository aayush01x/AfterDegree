import { layoutCells, numberText, type CellFontName } from "./cellFont";
import styles from "./CellDigits.module.css";

export interface CellDigitsProps {
  value: number | string;
  /** Cell pitch in px. Tile counts use 3 to 5; inline counts 2. */
  pitch?: number;
  font?: CellFontName;
  tone?: "ink" | "paper" | "accent" | "muted" | "current";
  /** Gap between cells in px; default 1 when pitch >= 8, else 0 (solid small digits). */
  gap?: number;
  /** Accessible label; defaults to the value. */
  label?: string;
  /** Cells appear in reading order when the value changes. */
  assemble?: boolean;
  className?: string;
}

/**
 * Cell-built digits for headline and tile counts only. Tables, badges, chips
 * and evidence keys use plain tabular figures.
 */
export function CellDigits({ value, pitch = 2, font = "5x7", tone = "current", gap, label, assemble = false, className }: CellDigitsProps) {
  const text = numberText(value);
  const { cols, rows, cells } = layoutCells(text, font);
  const g = gap ?? (pitch >= 8 ? 1 : 0);
  const w = Math.max(0, cols * pitch - g);
  const h = rows * pitch - g;
  const size = pitch - g;
  return (
    <svg
      key={assemble ? text : undefined}
      className={[styles.digits, styles[tone], className].filter(Boolean).join(" ")}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label ?? text}
      shapeRendering="crispEdges"
    >
      {cells.map(([c, r], i) => (
        <rect
          key={`${c}-${r}`}
          className={assemble ? "ad-assemble" : undefined}
          style={assemble ? { ["--i" as string]: i, ["--n" as string]: cells.length } : undefined}
          x={c * pitch}
          y={r * pitch}
          width={size}
          height={size}
        />
      ))}
    </svg>
  );
}
