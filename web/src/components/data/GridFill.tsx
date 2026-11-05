import styles from "./GridFill.module.css";

export interface GridFillProps {
  done: number;
  total: number;
  /** How many cells the grid has. */
  cells?: number;
  /** Cell size in px. */
  size?: number;
  /** Drawn directly on the orange field instead of on white. */
  onOrange?: boolean;
}

/** Loading state: the grid fills cell by cell as progress advances. */
export function GridFill({ done, total, cells = 64, size = 14, onOrange = false }: GridFillProps) {
  const filled = total > 0 ? Math.min(cells, Math.round((done / total) * cells)) : 0;
  return (
    <div className={[styles.fill, onOrange && styles.onOrange].filter(Boolean).join(" ")} aria-hidden="true">
      <div className={styles.cells} style={{ ["--c" as string]: `${size}px` }}>
        {Array.from({ length: cells }, (_, i) => (
          <i key={i} className={[styles.cell, i < filled && styles.on, i === filled && filled < cells && styles.next].filter(Boolean).join(" ")} />
        ))}
      </div>
    </div>
  );
}
