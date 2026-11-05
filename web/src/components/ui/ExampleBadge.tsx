import { IS_MOCK } from "@/lib/api";
import styles from "./ExampleBadge.module.css";

/** Marks example (mock) numbers. Renders nothing in live mode unless `force`. */
export function ExampleBadge({ children = "Example data", force = false }: { children?: string; force?: boolean }) {
  if (!IS_MOCK && !force) return null;
  return <span className={styles.badge}>{children}</span>;
}
