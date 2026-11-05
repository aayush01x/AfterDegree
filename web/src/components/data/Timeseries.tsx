"use client";

import { useEffect, useRef, useState } from "react";
import type { TimeSeries, TimeseriesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import styles from "./Timeseries.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function periodLabel(p: string): string {
  let m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ’${m[1].slice(2)}`;
  m = /^(\d{4})-?Q([1-4])$/i.exec(p);
  if (m) return `Q${m[2]} ’${m[1].slice(2)}`;
  return p;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function Key({ i }: { i: number }) {
  return (
    <svg className={styles.key} viewBox="0 0 24 10" aria-hidden="true">
      <line x1="0" y1="5" x2="24" y2="5" className={styles[`line${i % 3}`]} />
      <rect x="9" y="2" width="6" height="6" className={styles[`dot${i % 3}`]} />
    </svg>
  );
}

/** Simple SVG line chart with square markers, plus a hidden data table. */
export function Timeseries({ data, height = 220 }: { data: TimeseriesData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series: TimeSeries[] = data.series?.length ? data.series : [{ key: "value", label: data.unit ?? "Value", points: data.points ?? [] }];
  const periods = series[0]?.points.map((p) => p.period) ?? [];
  const maxV = niceMax(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.value))));
  const pad = { l: 44, r: 48, t: 12, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (periods.length <= 1 ? w / 2 : (i / (periods.length - 1)) * w);
  const y = (v: number) => pad.t + h - (v / maxV) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxV);
  const every = Math.max(1, Math.ceil(periods.length / Math.max(2, Math.floor(w / 72))));
  const label = series.map((s) => `${s.label}: ${s.points.map((p) => `${periodLabel(p.period)} ${fmtInt(p.value)}`).join(", ")}`).join(". ");

  return (
    <div ref={ref} className={styles.wrap}>
      {series.length > 1 && (
        <p className={styles.legend} aria-hidden="true">
          {series.map((s, i) => (
            <span key={s.key}>
              <Key i={i} />
              {s.label}
            </span>
          ))}
        </p>
      )}
      <svg className={styles.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} className={t === 0 ? styles.axis : styles.grid} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className={styles.tick}>
              {fmtInt(t)}
            </text>
          </g>
        ))}
        {periods.map((p, i) =>
          i % every === 0 || i === periods.length - 1 ? (
            <text key={p} x={x(i)} y={height - 8} textAnchor="middle" className={styles.tick}>
              {periodLabel(p)}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.key}>
              <path d={d} className={styles[`line${si % 3}`]} />
              {s.points.map((p, i) => (
                <rect key={p.period} x={x(i) - 4} y={y(p.value) - 4} width="8" height="8" className={styles[`dot${si % 3}`]} />
              ))}
              {last && (
                <text x={x(s.points.length - 1) + 10} y={y(last.value) + 5} className={styles.last}>
                  {fmtInt(last.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={p}>
              <th scope="row">{periodLabel(p)}</th>
              {series.map((s) => (
                <td key={s.key}>{s.points[i] ? fmtInt(s.points[i].value) : "–"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
