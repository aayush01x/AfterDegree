import type { PersonStep } from "@/lib/drill-types";
import { pathSpan, stageLabel, stagesByYear, stageToken } from "./stages";
import styles from "./CareerStrip.module.css";

export interface CareerStripProps {
  steps: PersonStep[];
  from?: number;
  to?: number;
  /** Cell width in px. */
  cell?: number;
  gap?: number;
  /** Cell height in px (defaults to the width). */
  height?: number;
  years?: "ends" | "all" | "none";
  tone?: "paper" | "band";
  label?: string;
  className?: string;
}

/** One cell per year, coloured by career stage; a year with two stages splits its cell. */
export function CareerStrip({ steps, from, to, cell = 16, gap = 2, height, years = "ends", tone = "paper", label, className }: CareerStripProps) {
  const [f0, t0] = pathSpan(steps);
  const a = from ?? f0;
  const b = to ?? t0;
  const byYear = stagesByYear(steps, a, b);
  const h = height ?? cell;
  const W = byYear.length * (cell + gap) - gap;
  const H = h + (years === "none" ? 0 : 16);
  const desc =
    label ??
    `Career path ${a} to ${b}: ` +
      byYear
        .map((st, i) => `${a + i} ${st.length ? st.map(stageLabel).join(" then ") : "no role listed"}`)
        .join(", ");
  return (
    <svg className={[styles.strip, styles[tone], className].filter(Boolean).join(" ")} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc} shapeRendering="crispEdges">
      {byYear.map((st, i) => {
        const x = i * (cell + gap);
        if (!st.length) return <rect key={i} className={styles.gap} x={x + 0.5} y={0.5} width={cell - 1} height={h - 1} />;
        const pw = cell / st.length;
        return (
          <g key={i}>
            {st.map((s, j) => (
              <rect key={s} x={x + j * pw} y={0} width={pw} height={h} style={{ fill: stageToken(s) }} />
            ))}
            <rect className={styles.edge} x={x + 0.5} y={0.5} width={cell - 1} height={h - 1} />
          </g>
        );
      })}
      {years === "ends" && (
        <>
          <text className={styles.yr} x={0} y={h + 13}>
            {a}
          </text>
          <text className={styles.yr} x={W} y={h + 13} textAnchor="end">
            {b}
          </text>
        </>
      )}
      {years === "all" &&
        byYear.map((_, i) => (
          <text key={i} className={styles.yr} x={i * (cell + gap) + cell / 2} y={h + 13} textAnchor="middle">
            {cell >= 28 ? a + i : `’${String(a + i).slice(2)}`}
          </text>
        ))}
    </svg>
  );
}
