import type { StatData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { CountDisplay } from "./CountDisplay";
import { GridNumber } from "./GridNumber";
import styles from "./Stat.module.css";

const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;

/**
 * One headline number. `hero` builds it from grid cells: "At least / 214 /
 * of 312 people like you …".
 */
export function Stat({ data, variant = "default", cell = 32 }: { data: StatData; variant?: "default" | "hero"; cell?: number }) {
  const c = data.count ?? null;
  const value = c ? c.k : (data.value ?? null);

  if (variant === "hero" && value !== null) {
    const lower = !!c && c.share !== null;
    return (
      <div className={styles.hero}>
        {lower && <p className={styles.least}>At least</p>}
        <GridNumber value={value} cell={cell} label={data.display ?? (c ? c.display : fmtInt(value))} />
        <p className={styles.sentence}>
          {c ? `of ${fmtInt(c.n)} ${data.label.replace(/^of\s+/i, "")}` : data.label}
          {c && c.share === null && " (too few to compare)"}
        </p>
        {data.note && <p className={styles.note}>{data.note}</p>}
      </div>
    );
  }

  return (
    <div className={styles.stat}>
      {c ? (
        <>
          <p className={styles.value}>
            {fmtInt(c.k)}
            <span className={styles.of}>of {fmtInt(c.n)}</span>
          </p>
          <p className={styles.label}>{data.label}</p>
          <CountDisplay count={c} size="sm" showShare />
        </>
      ) : (
        <>
          <p className={styles.value}>{data.display ?? (value !== null ? fmtInt(value) : "–")}</p>
          <p className={styles.label}>
            {data.unit ? `${data.unit} ` : ""}
            {data.label}
          </p>
        </>
      )}
      {data.level && <span className={[styles.level, styles[`level_${data.level}`]].join(" ")}>{LEVEL[data.level]}</span>}
      {data.note && <p className={styles.note}>{data.note}</p>}
    </div>
  );
}
