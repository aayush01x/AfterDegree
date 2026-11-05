import { IS_MOCK } from "@/lib/api";
import styles from "./ExampleBadge.module.css";

/**
 * Marks example (mock) numbers. Renders nothing in live mode unless `force`.
 * Place it inline after a heading (never as an eyebrow above it).
 */
export function ExampleBadge({ children = "Example data", force = false, inline = true }: { children?: string; force?: boolean; inline?: boolean }) {
  if (!IS_MOCK && !force) return null;
  return <span className={[styles.badge, inline && styles.inline].filter(Boolean).join(" ")}>{children}</span>;
}
