import { layoutCells, numberText } from "./cellFont";
import styles from "./GridNumber.module.css";

export interface GridNumberProps {
  value: number;
  /** Cell pitch in px (the construction grid is 32). */
  cell?: number;
  /** Gap between cells in px. */
  gap?: number;
  tone?: "ink" | "paper" | "accent" | "orange";
  /** Accessible label; defaults to the number itself. */
  label?: string;
  className?: string;
}

/**
 * The monumental headline number, built from 5x7 cells on the 32px grid. When the
 * value changes the SVG is re-keyed, so the cells rebuild one by one in reading
 * order (instant under reduced motion, handled globally).
 */
export function GridNumber({ value, cell = 32, gap = 1, tone = "ink", label, className }: GridNumberProps) {
  const text = numberText(value);
  const { cols, rows, cells } = layoutCells(text, "5x7");
  const w = cols * cell;
  const h = rows * cell;
  const size = cell - gap;
  return (
    <svg
      key={text}
      className={[styles.svg, styles[tone === "orange" ? "accent" : tone], className].filter(Boolean).join(" ")}
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
          className="ad-assemble"
          style={{ ["--i" as string]: i, ["--n" as string]: cells.length }}
          x={c * cell + gap}
          y={r * cell + gap}
          width={size}
          height={size}
        />
      ))}
    </svg>
  );
}
