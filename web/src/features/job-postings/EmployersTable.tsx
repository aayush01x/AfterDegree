"use client";

import type { RankedRow, RankedTableData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { drillOf } from "@/components/data/Drillable";
import { useDrill } from "@/components/drill/useDrill";
import styles from "./EmployersTable.module.css";

export type HireSignal = "high" | "some" | "unclear";

/** Reads the engine's badge text, or works it out from hires per posting when no badge is given. */
export function signalOf(row: RankedRow): HireSignal {
  const raw = [...(Array.isArray(row.cells.signal) ? row.cells.signal : typeof row.cells.signal === "string" ? [row.cells.signal] : []), ...(row.badges ?? [])]
    .join(" ")
    .toLowerCase();
  if (/unclear|no matching|none/.test(raw)) return "unclear";
  if (/few|some/.test(raw)) return "some";
  if (/high|hires seen/.test(raw)) return "high";
  const postings = Number(row.cells.postings ?? 0);
  const hires = Number(row.cells.hires ?? 0);
  const ratio = postings > 0 ? hires / postings : 0;
  return ratio >= 0.3 ? "high" : ratio >= 0.1 ? "some" : "unclear";
}

const TEXT: Record<HireSignal, { name: string; note: string }> = {
  high: { name: "High", note: "Postings here have often been followed by matching hires." },
  some: { name: "Some", note: "Some matching hires seen after postings." },
  unclear: { name: "Unclear", note: "No matching hires seen yet." },
};

const TILE = 12;

export function EmployersTable({ data }: { data: RankedTableData }) {
  const drill = useDrill();
  const real = data.rows.filter((r) => !r.rest);
  const max = Math.max(1, ...real.map((r) => Number(r.cells.postings ?? 0)));
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Employers posting most, scrollable">
      <table className={styles.table}>
        <caption className="visually-hidden">Employers with the most postings and whether their postings have led to matching hires</caption>
        <thead>
          <tr>
            <th scope="col">Employer</th>
            <th scope="col" className={styles.right}>
              Postings
            </th>
            <th scope="col" className={styles.right}>
              Matching hires seen
            </th>
            <th scope="col">Hire-through</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => {
            const postings = Number(row.cells.postings ?? 0);
            const hires = Number(row.cells.hires ?? 0);
            const sig = row.rest ? null : signalOf(row);
            const cells = Math.max(postings > 0 ? 1 : 0, Math.round((postings / max) * TILE));
            const name = String(row.cells.employer ?? "");
            const tok = row.rest ? undefined : drillOf(row);
            return (
              <tr key={row.id ?? ri} className={[row.rest && styles.rest, tok && styles.link].filter(Boolean).join(" ")}>
                <th scope="row">
                  {tok ? (
                    <button type="button" className={styles.pick} onClick={() => drill.open(tok, name)} aria-label={`${name}: ${fmtInt(postings)} postings. Open the company profile`}>
                      {name}
                    </button>
                  ) : (
                    name
                  )}
                </th>
                <td className={styles.right}>
                  <span className={styles.postings}>
                    {!row.rest && (
                      <span className={styles.bar} aria-hidden="true">
                        {Array.from({ length: cells }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    )}
                    <b>{fmtInt(postings)}</b>
                  </span>
                </td>
                <td className={styles.right}>
                  <b>{fmtInt(hires)}</b>
                </td>
                <td>
                  {sig ? (
                    <span className={styles.signal}>
                      <span className={`${styles.badge} ${styles[sig]}`}>{TEXT[sig].name}</span>
                      <span className={styles.note}>{TEXT[sig].note}</span>
                    </span>
                  ) : (
                    <span className={styles.note}>Not rated for a group</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
