import type { ReactNode } from "react";
import styles from "./Chip.module.css";

function Cross() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Chip({
  children,
  onRemove,
  removeLabel,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <span className={[styles.chip, selected && styles.selected].filter(Boolean).join(" ")}>
      {onClick ? (
        <button type="button" className={styles.label} onClick={onClick} aria-pressed={selected}>
          {children}
        </button>
      ) : (
        <span className={styles.label}>{children}</span>
      )}
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label={removeLabel ?? `Remove ${String(children)}`}>
          <Cross />
        </button>
      )}
    </span>
  );
}
