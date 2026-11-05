import { useId, type ReactNode } from "react";
import styles from "./Panel.module.css";

export interface PanelProps {
  title: ReactNode;
  /** Evidence key slot (usually <EvidenceKey />), right of the title. */
  evidence?: ReactNode;
  caption?: ReactNode;
  as?: "section" | "div" | "article";
  headingLevel?: 2 | 3;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** White work panel with a 1px rule, a title and an evidence key slot. */
export function Panel({ title, evidence, caption, as: Tag = "section", headingLevel = 2, actions, className, children }: PanelProps) {
  const id = useId();
  const H = headingLevel === 3 ? "h3" : "h2";
  return (
    <Tag className={[styles.panel, className].filter(Boolean).join(" ")} aria-labelledby={id}>
      <div className={styles.head}>
        <H id={id} className={[styles.title, headingLevel === 3 && styles.h3].filter(Boolean).join(" ")}>
          {title}
        </H>
        {evidence}
      </div>
      {caption && <p className={styles.caption}>{caption}</p>}
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </Tag>
  );
}
