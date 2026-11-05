import { fmtInt, fmtPct } from "@/lib/format";
import styles from "./CellSplit.module.css";

export interface SplitPart {
  label: string;
  count: number;
}

const CELLS = 40;
const TONES = ["a", "b", "c"] as const;

/** Largest-remainder rounding so the cells always add up to CELLS. */
function allocate(parts: SplitPart[], total: number): number[] {
  if (total <= 0) return parts.map(() => 0);
  const raw = parts.map((p) => (p.count / total) * CELLS);
  const out = raw.map(Math.floor);
  let left = CELLS - out.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/** One bar of 40 cells split into parts, with a legend that carries the real counts. */
export function CellSplit({ parts, total, unit = "postings", label }: { parts: SplitPart[]; total: number; unit?: string; label: string }) {
  const cells = allocate(parts, total);
  let seq = 0;
  const showShare = total >= 10;
  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="img" aria-label={label}>
        {parts.flatMap((p, pi) =>
          Array.from({ length: cells[pi] }, (_, i) => (
            <i
              key={`${pi}-${i}`}
              className={`${styles.cell} ${styles[TONES[Math.min(pi, 2)]]} ad-assemble`}
              style={{ ["--i" as string]: seq++, ["--n" as string]: CELLS }}
            />
          )),
        )}
      </div>
      <ul className={styles.legend}>
        {parts.map((p, pi) => (
          <li key={p.label} className={styles.item}>
            <i className={`${styles.swatch} ${styles[TONES[Math.min(pi, 2)]]}`} aria-hidden="true" />
            <span className={styles.name}>{p.label}</span>
            <span className={styles.val}>
              {fmtInt(p.count)} {unit}
              {showShare && <span className={styles.share}> ({fmtPct(p.count / total)})</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
