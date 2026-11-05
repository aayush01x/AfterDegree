import type { KeywordsData } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { CellBar } from "./CellBar";
import styles from "./KeywordList.module.css";

/** Terms with counts and shares. `you_have` terms get a filled marker. */
export function KeywordList({ data }: { data: KeywordsData }) {
  const items = data.items ?? [];
  const max = Math.max(1, ...items.map((i) => i.count));
  const anyYou = items.some((i) => i.you_have !== undefined);
  return (
    <div>
      <ul role="list" className={styles.list}>
        {items.map((i) => (
          <li key={i.term} className={styles.item}>
            {anyYou ? (
              <span className={[styles.mark, i.you_have && styles.have].filter(Boolean).join(" ")} aria-hidden="true" />
            ) : (
              <span aria-hidden="true" />
            )}
            <span className={styles.term}>
              {i.term}
              {anyYou && <span className="visually-hidden">{i.you_have ? " (on your profile)" : " (not on your profile yet)"}</span>}
            </span>
            <span className={styles.count}>
              {fmtInt(i.count)}
              {i.share != null && <small>{fmtPct(i.share)}</small>}
            </span>
            <span className={styles.bar}>
              <CellBar value={i.count} max={max} />
            </span>
          </li>
        ))}
      </ul>
      {anyYou && (
        <p className={styles.legend}>
          <span>
            <i className={`${styles.mark} ${styles.have}`} aria-hidden="true" />
            On your profile
          </span>
          <span>
            <i className={styles.mark} aria-hidden="true" />
            Not yet
          </span>
        </p>
      )}
    </div>
  );
}
