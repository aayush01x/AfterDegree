import type { ReactNode } from "react";
import styles from "./Tag.module.css";

/** Small solid label: "Your target", "Fits you best", "since 2024", "Counts only". */
export function Tag({ children, tone = "ink", className }: { children: ReactNode; tone?: "ink" | "accent" | "soft" | "paper"; className?: string }) {
  return <span className={[styles.tag, styles[tone], className].filter(Boolean).join(" ")}>{children}</span>;
}
