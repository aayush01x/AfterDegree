import type { TimeseriesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import styles from "./StackedCells.module.css";

/** Postings by month as stacked cell columns. Series stack from the bottom; one cell is `unit` postings. */

const PER_ROW = 3;
const MAX_CELLS = 36;
const TONES = ["hollow", "orange", "ink"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodLabel(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m ? MONTHS[Number(m[2]) - 1] : p;
}

function yearOf(p: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  return m ? m[1] : null;
}

function unitFor(max: number) {
  for (const u of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (max / u <= MAX_CELLS) return u;
  return 1000;
}

export function StackedCells({ data }: { data: TimeseriesData }) {
  const series = data.series?.length
    ? data.series
    : data.points
      ? [{ key: "all", label: data.unit ?? "postings", points: data.points }]
      : [];
  if (!series.length) return null;

  const periods = series[0].points.map((p) => p.period);
  const val = (si: number, pi: number) => series[si].points.find((p) => p.period === periods[pi])?.value ?? 0;
  const totals = periods.map((_, pi) => series.reduce((s, _x, si) => s + val(si, pi), 0));
  const unit = unitFor(Math.max(1, ...totals));
  const noun = data.unit ?? "postings";
  const multi = series.length > 1;
  let seq = 0;
  const allCells = totals.reduce((s, t) => s + Math.round(t / unit), 0);

  return (
    <div className={styles.wrap}>
      <ol className={styles.cols} style={{ ["--cols" as string]: periods.length }}>
        {periods.map((period, pi) => {
          let cumulative = 0;
          let cellsBefore = 0;
          const cells: { tone: string }[] = [];
          series.forEach((_s, si) => {
            cumulative += val(si, pi);
            const upto = Math.round(cumulative / unit);
            for (let c = cellsBefore; c < upto; c++) cells.push({ tone: multi ? TONES[Math.min(si, 2)] : "orange" });
            cellsBefore = Math.max(cellsBefore, upto);
          });
          const year = yearOf(period);
          const showYear = year && (pi === 0 || periods[pi].endsWith("-01"));
          return (
            <li key={period} className={styles.col}>
              <p className={styles.total}>{fmtInt(totals[pi])}</p>
              <div className={styles.stack} aria-hidden="true">
                {cells.map((c, i) => (
                  <i key={i} className={`${styles.cell} ${styles[c.tone]} ad-assemble`} style={{ ["--i" as string]: seq++, ["--n" as string]: allCells }} />
                ))}
              </div>
              <p className={styles.month}>
                {periodLabel(period)}
                {showYear && <span className={styles.year}> {year}</span>}
              </p>
            </li>
          );
        })}
      </ol>
      <div className={styles.legend}>
        {multi && (
          <ul className={styles.keys}>
            {[...series].map((s, si) => (
              <li key={s.key}>
                <i className={`${styles.swatch} ${styles[TONES[Math.min(si, 2)]]}`} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        <p className={styles.unit}>
          {unit === 1 ? `One cell is one ${noun.replace(/s$/, "")}.` : `One cell is about ${fmtInt(unit)} ${noun}.`} The number above a column is its true total.
        </p>
      </div>
      <table className="visually-hidden">
        <caption>{noun} by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {series.map((s) => (
              <th scope="col" key={s.key}>
                {s.label}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p, pi) => (
            <tr key={p}>
              <th scope="row">{p}</th>
              {series.map((s, si) => (
                <td key={s.key}>{val(si, pi)}</td>
              ))}
              <td>{totals[pi]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
