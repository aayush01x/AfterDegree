import type { RouteListData } from "@/lib/types";
import { isCount } from "@/lib/count";
import { fmtInt } from "@/lib/format";
import { CountDisplay } from "./CountDisplay";
import styles from "./RouteList.module.css";

const FIT_LABEL = { fits_you: "Fits your start", stretch: "A stretch", far: "Further from you" } as const;

/** Ordered paths with how many people took them, typical years and gaps to close. */
export function RouteList({ data }: { data: RouteListData }) {
  return (
    <ol role="list" className={styles.list}>
      {(data.routes ?? []).map((r, i) => (
        <li key={r.id} className={styles.route}>
          <div className={styles.head}>
            <h3 className={styles.title}>
              {r.title ?? `Route ${i + 1}`}
              {r.fit && <span className={[styles.fit, styles[r.fit]].join(" ")}>{FIT_LABEL[r.fit]}</span>}
            </h3>
            <p className={styles.meta}>
              {isCount(r.people) ? <CountDisplay count={r.people} size="sm" /> : <strong>{fmtInt(r.people)} people</strong>}
              {r.typical_years != null && <span className={styles.muted}>about {r.typical_years} years end to end</span>}
            </p>
          </div>
          <ol role="list" className={styles.steps} aria-label="Steps">
            {r.steps.map((s, si) => (
              <li key={si} className={styles.step}>
                {si > 0 && <span className={styles.join} aria-hidden="true" />}
                <span className={styles.box}>
                  {s.label}
                  {s.years != null && <span className={styles.years}>{s.years} yrs</span>}
                </span>
              </li>
            ))}
          </ol>
          {r.gaps?.length > 0 && (
            <div className={styles.gaps}>
              <h4>To close the gap</h4>
              <ul>
                {r.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
