import type { DistributionData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { useDrill } from "@/components/drill/useDrill";
import { drillOf } from "@/components/data/Drillable";
import styles from "./CellColumns.module.css";

/** A distribution drawn as columns of cells, one cell per person (scaled only when a column is very tall). */

const PER_ROW = 6;
const MAX_ROWS = 24;

function unitFor(max: number) {
  for (const u of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (max / u <= PER_ROW * MAX_ROWS) return u;
  return 1000;
}

export function CellColumns({ data, noun = "people" }: { data: DistributionData; noun?: string }) {
  const items = data.items;
  const max = Math.max(1, ...items.map((i) => i.count));
  const unit = unitFor(max);
  const n = data.n || items.reduce((s, i) => s + i.count, 0);
  const total = items.reduce((s, i) => s + Math.ceil(i.count / unit), 0);
  const drill = useDrill();
  let seq = 0;

  return (
    <div className={styles.wrap}>
      <ul className={styles.cols} style={{ ["--cols" as string]: items.length }}>
        {items.map((item) => {
          const cells = Math.max(item.count > 0 ? 1 : 0, Math.round(item.count / unit));
          const tone = item.target ? styles.target : item.remainder ? styles.hollow : "";
          const tok = drillOf(item);
          const inner = (
            <>
              <div className={styles.stack} aria-hidden="true">
                {Array.from({ length: cells }, (_, i) => (
                  <i
                    key={i}
                    className={`${styles.cell} ${tone} ad-assemble`}
                    style={{ ["--i" as string]: seq++, ["--n" as string]: total }}
                  />
                ))}
              </div>
              <p className={styles.num}>{fmtInt(item.count)}</p>
              <p className={styles.label}>{item.label}</p>
            </>
          );
          return (
            <li key={item.label} className={styles.item}>
              {tok ? (
                <button
                  type="button"
                  className={`${styles.col} ${styles.drill}`}
                  onClick={() => drill.open(tok, item.label)}
                  aria-label={`${item.label}: ${fmtInt(item.count)} ${noun}. See who they are`}
                >
                  {inner}
                </button>
              ) : (
                <div className={styles.col}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.key}>
        {unit === 1 ? `One cell is one ${noun === "people" ? "person" : noun.replace(/s$/, "")}.` : `One cell is about ${fmtInt(unit)} ${noun}.`}{" "}
        Out of {fmtInt(n)} we can see.
        {items.some((i) => i.target) && " Black cells are where you are today."}
      </p>
    </div>
  );
}
