import type { DistributionData } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { CellBar } from "./CellBar";
import styles from "./Distribution.module.css";

/** Labelled counts as cell bars. Target rows invert; remainder rows draw hollow. */
export function Distribution({ data, maxRows, compact = false }: { data: DistributionData; maxRows?: number; compact?: boolean }) {
  const items = data.items ?? [];
  const main = items.filter((i) => !i.remainder);
  const rest = items.filter((i) => i.remainder);
  const shown = [...(maxRows ? main.slice(0, maxRows) : main), ...rest];
  const max = Math.max(1, ...items.map((i) => i.count));
  const n = data.n || items.reduce((s, i) => s + i.count, 0);
  return (
    <ul role="list" className={[styles.list, compact && styles.compact].filter(Boolean).join(" ")}>
      {shown.map((i) => {
        const share = i.share ?? (n ? i.count / n : null);
        return (
          <li key={i.label} className={[styles.row, i.target && styles.target, i.remainder && styles.remainder].filter(Boolean).join(" ")}>
            <span className={styles.label}>
              {i.label}
              {i.target && <span className={styles.tag}>Target</span>}
            </span>
            <CellBar value={i.count} max={max} hollow={i.remainder} />
            <span className={styles.value}>
              {fmtInt(i.count)}
              {share !== null && n >= 10 && (compact ? <span className="visually-hidden"> ({fmtPct(share)})</span> : <span className={styles.share}>{fmtPct(share)}</span>)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
