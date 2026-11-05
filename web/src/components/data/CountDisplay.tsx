import { useId } from "react";
import type { Count } from "@/lib/types";
import { fmtPct } from "@/lib/format";
import styles from "./CountDisplay.module.css";

export function intervalText(c: Count): string {
  if (!c.ci || c.share === null) return `Only ${c.n} people, too few to give a reliable share.`;
  return `Likely between ${fmtPct(c.ci[0])} and ${fmtPct(c.ci[1])} (95% interval). Observed ${fmtPct(c.share)}.`;
}

/** "at least 24 of 37", with the interval on hover or focus. */
export function CountDisplay({ count, size = "md", showShare = false }: { count: Count; size?: "sm" | "md" | "lg"; showShare?: boolean }) {
  const id = useId();
  const tip = intervalText(count);
  const sizeClass = styles[size];
  return (
    <span className={[styles.wrap, sizeClass].join(" ")}>
      <button type="button" className={styles.trigger} aria-describedby={id}>
        {count.display}
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {tip}
      </span>
      {showShare && count.share !== null && <span className={styles.share}>{fmtPct(count.share)}</span>}
    </span>
  );
}
