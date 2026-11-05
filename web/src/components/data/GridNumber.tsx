import { layoutGlyphs, GLYPH_ROWS } from "@/lib/glyphs";
import styles from "./GridNumber.module.css";

export interface GridNumberProps {
  value: number;
  /** Cell pitch in px (the construction grid is 32). */
  cell?: number;
  /** Gap between cells in px. */
  gap?: number;
  tone?: "ink" | "paper" | "orange";
  /** Accessible label; defaults to the number itself. */
  label?: string;
  className?: string;
}

/**
 * A number (integers, or one decimal) built from 5x7 square cells. When the value changes the SVG is
 * re-keyed, so the cells rebuild one by one in reading order (instant under
 * reduced motion, handled globally).
 */
export function GridNumber({ value, cell = 32, gap = 3, tone = "ink", label, className }: GridNumberProps) {
  const text = !Number.isFinite(value) ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1);
  const { cols, cells } = layoutGlyphs(text);
  const w = cols * cell - gap;
  const h = GLYPH_ROWS * cell - gap;
  const size = cell - gap;
  return (
    <svg
      key={text}
      className={[styles.svg, styles[tone], className].filter(Boolean).join(" ")}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label ?? text}
    >
      {cells.map(([c, r], i) => (
        <rect
          key={`${c}-${r}`}
          className="ad-assemble"
          style={{ ["--i" as string]: i, ["--n" as string]: cells.length }}
          x={c * cell}
          y={r * cell}
          width={size}
          height={size}
        />
      ))}
    </svg>
  );
}
