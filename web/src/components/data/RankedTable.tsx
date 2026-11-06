"use client";

import { Drillable, drillOf } from "./Drillable";
import { useMemo, useState } from "react";
import type { CellValue, Count, RankedColumn, RankedRow, RankedTableData } from "@/lib/types";
import { isCount } from "@/lib/count";
import { fmtInt, fmtPct } from "@/lib/format";
import { CellBar } from "./CellBar";
import { intervalText } from "./CountDisplay";
import styles from "./RankedTable.module.css";

type Dir = "asc" | "desc";

const numeric = (c: RankedColumn) => c.type !== "text" && c.type !== "badges";

function sortValue(v: CellValue | undefined): number | string {
  if (v === null || v === undefined) return -Infinity;
  if (isCount(v)) return v.share ?? (v.n ? v.k / v.n : 0);
  if (Array.isArray(v)) return v.length;
  return v;
}

function barValue(v: CellValue | undefined): number {
  if (isCount(v)) return v.share ?? (v.n ? v.k / v.n : 0);
  return typeof v === "number" ? v : 0;
}

function renderValue(col: RankedColumn, v: CellValue | undefined, row: RankedRow) {
  if (v === null || v === undefined || v === "") return <span className={styles.sub}>–</span>;
  if (col.type === "badges") {
    const list = Array.isArray(v) ? v : [String(v)];
    if (!list.length) return <span className={styles.sub}>–</span>;
    return (
      <span className={styles.badges}>
        {list.map((b) => (
          <span key={b} className={styles.badge}>
            {b}
          </span>
        ))}
      </span>
    );
  }
  if (isCount(v)) return <CountCell c={v} />;
  if (col.type === "years" && typeof v === "number") return `${v.toFixed(1)} yrs`;
  if (col.type === "share" && typeof v === "number") return fmtPct(v);
  if (typeof v === "number") return fmtInt(v);
  if (Array.isArray(v)) return v.join(", ");
  void row;
  return v;
}

function CountCell({ c }: { c: Count }) {
  return (
    <span>
      {c.share !== null ? fmtPct(c.share) : "Too few"}
      <span className={styles.sub}>
        {c.k} of {c.n}
      </span>
      <span className="visually-hidden">{intervalText(c)}</span>
    </span>
  );
}

function Arrow({ dir }: { dir: Dir | null }) {
  return (
    <svg className={styles.arrow} viewBox="0 0 8 8" aria-hidden="true">
      {dir === "asc" ? <path d="M0 6h8L4 1z" fill="currentColor" /> : dir === "desc" ? <path d="M0 2h8L4 7z" fill="currentColor" /> : <path d="M1 3h6M1 5h6" stroke="currentColor" />}
    </svg>
  );
}

export interface RankedTableProps {
  data: RankedTableData;
  caption?: string;
  sortable?: boolean;
  /** Show this many rows, with a "show all" control for the rest. */
  maxRows?: number;
}

/** Fixed columns, tabular figures, inline cell bars, sortable headers. */
export function RankedTable({ data, caption, sortable = true, maxRows }: RankedTableProps) {
  const cols = useMemo(() => data.columns ?? [], [data.columns]);
  const [sort, setSort] = useState<{ key: string; dir: Dir } | null>(data.default_sort ?? null);
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const all = data.rows ?? [];
    const main = all.filter((r) => !r.rest);
    const rest = all.filter((r) => r.rest);
    if (sort) {
      main.sort((a, b) => {
        const x = sortValue(a.cells[sort.key]);
        const y = sortValue(b.cells[sort.key]);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return [...main, ...rest];
  }, [data.rows, sort]);

  const max = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cols) if (c.bar) m[c.key] = Math.max(0, ...(data.rows ?? []).filter((r) => !r.rest).map((r) => barValue(r.cells[c.key])));
    return m;
  }, [cols, data.rows]);

  const visible = maxRows && !expanded ? rows.slice(0, maxRows) : rows;
  const toggle = (key: string, isNum: boolean) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: isNum ? "desc" : "asc" }));

  /* First column keeps at least 22%; the others share the rest in proportion to their kind. */
  const widths = useMemo(() => {
    const base: number[] = cols.map((c, i) => (i === 0 ? 0 : c.bar ? 40 : c.type === "badges" ? 26 : c.type === "text" ? 22 : 15));
    const sum = base.reduce((a, b) => a + b, 0);
    const k = sum > 78 ? 78 / sum : 1;
    return base.map((w, i) => (i === 0 ? undefined : `${(w * k).toFixed(1)}%`));
  }, [cols]);
  const colWidth = (_c: RankedColumn, i: number) => widths[i];

  return (
    <div className={styles.wrap}>
      <table className={styles.table} style={{ minWidth: cols.length > 2 ? cols.length * 112 : undefined }}>
        {caption && <caption className={styles.caption}>{caption}</caption>}
        <colgroup>
          {cols.map((c, i) => (
            <col key={c.key} style={{ width: colWidth(c, i) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort?.key === c.key;
              const aria = active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined;
              return (
                <th key={c.key} scope="col" className={[styles.th, numeric(c) && styles.num].filter(Boolean).join(" ")} aria-sort={aria}>
                  {sortable ? (
                    <button type="button" className={styles.sort} onClick={() => toggle(c.key, numeric(c))}>
                      {c.label}
                      <Arrow dir={active ? sort!.dir : null} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, ri) => (
            <Drillable
              as="tr"
              key={r.id ?? ri}
              token={r.rest ? null : (drillOf(r) ?? null)}
              label={String(r.cells[cols[0]?.key] ?? "")}
              className={[r.you && styles.you, r.rest && styles.rest].filter(Boolean).join(" ") || undefined}
            >
              {cols.map((c, ci) => {
                const v = r.cells[c.key];
                const Cell = ci === 0 ? "th" : "td";
                return (
                  <Cell key={c.key} scope={ci === 0 ? "row" : undefined} className={[styles.td, ci === 0 && styles.label, numeric(c) && !c.bar && styles.num].filter(Boolean).join(" ")}>
                    {c.bar ? (
                      <span className={styles.barCell}>
                        <CellBar value={barValue(v)} max={max[c.key]} hollow={r.rest} />
                        <span className={styles.value}>{renderValue(c, v, r)}</span>
                      </span>
                    ) : (
                      renderValue(c, v, r)
                    )}
                    {ci === 0 && r.you && <span className={styles.youTag}>You</span>}
                    {ci === 0 && r.badges && r.badges.length > 0 && (
                      <span className={styles.badges}>
                        {r.badges.map((b) => (
                          <span key={b} className={styles.badge}>
                            {b}
                          </span>
                        ))}
                      </span>
                    )}
                  </Cell>
                );
              })}
            </Drillable>
          ))}
        </tbody>
      </table>
      {maxRows && rows.length > maxRows && (
        <button type="button" className={styles.more} onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
