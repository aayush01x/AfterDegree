import styles from "./CellBar.module.css";

/** Inline bar made of thin cells, sized as a share of the column maximum. */
export function CellBar({ value, max, hollow = false }: { value: number; max: number; hollow?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <span className={[styles.track, hollow && styles.hollow].filter(Boolean).join(" ")} aria-hidden="true">
      <span className={styles.bar} style={{ ["--w" as string]: pct, minWidth: pct > 0 ? 4 : 0 }} />
    </span>
  );
}
