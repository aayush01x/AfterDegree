"use client";

import type { KeywordsData } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { CellBar } from "@/components/data/CellBar";
import { Drillable, drillOf } from "@/components/data/Drillable";
import styles from "./SkillList.module.css";

/** Skills named in postings: term, count, share, cell bar. A skill with a drill token opens the postings that name it. */
export function SkillList({ data }: { data: KeywordsData }) {
  const items = data.items ?? [];
  const max = Math.max(1, ...items.map((i) => i.count));
  const anyYou = items.some((i) => i.you_have !== undefined);
  return (
    <div className={styles.wrap}>
      <ul role="list" className={styles.list}>
        {items.map((i) => (
          <Drillable
            key={i.term}
            as="li"
            token={drillOf(i)}
            label={i.term}
            actionLabel={`${i.term}: in ${fmtInt(i.count)} postings. See them`}
            className={styles.item}
          >
            {anyYou ? <span className={[styles.mark, i.you_have && styles.have].filter(Boolean).join(" ")} aria-hidden="true" /> : <span aria-hidden="true" />}
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
          </Drillable>
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
