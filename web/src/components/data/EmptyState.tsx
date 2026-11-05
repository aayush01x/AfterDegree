import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** paper: inside a panel; field: on the page field (draws its own paper card on the texture). */
  tone?: "paper" | "field";
  actions?: ReactNode;
  className?: string;
}

/** Offset-dot texture box for empty, thin and "too few people" states. */
export function EmptyState({ title, children, tone = "paper", actions, className }: EmptyStateProps) {
  return (
    <div className={["ad-dots", styles.box, styles[tone], className].filter(Boolean).join(" ")}>
      <div className={styles.card}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
