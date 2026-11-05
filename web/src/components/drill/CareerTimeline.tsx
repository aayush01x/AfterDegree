"use client";
// The half-year grid career timeline: one column per half year, one band of cells per step,
// coloured by career stage; part-time internships checkered; the move abroad marked; the opened
// role highlighted; a country track underneath. Years only (no months), per the privacy rules.
import type { CSSProperties } from "react";
import type { PersonStep } from "@/lib/drill-types";
import { homeCountry, stageOf, stageToken, STAGES, type Stage } from "@/components/art/stages";
import styles from "./CareerTimeline.module.css";

export interface Band {
  step: PersonStep;
  stage: Stage;
  /** 0-based half-year column, end exclusive. */
  start: number;
  end: number;
}

export const NOW_YEAR = new Date().getFullYear();
/** The half of the current year we are in (0 = Jan–Jun, 1 = Jul–Dec). */
export const NOW_HALF = new Date().getMonth() >= 6 ? 1 : 0;

/** Place a step on the half-year axis that starts at `from`: end anchored on end_year, length from `years`. */
export function bandOf(step: PersonStep, from: number, home: string): Band | null {
  if (step.start_year == null && step.end_year == null) return null;
  const nowCol = (NOW_YEAR - from) * 2 + NOW_HALF + 1;
  const end = step.end_year == null ? nowCol : Math.min(nowCol, (step.end_year - from) * 2);
  const len = step.years != null ? Math.max(1, Math.round(step.years * 2)) : Math.max(1, ((step.end_year ?? NOW_YEAR) - (step.start_year ?? NOW_YEAR)) * 2);
  let start = step.start_year != null ? Math.max((step.start_year - from) * 2, end - len) : end - len;
  if (start >= end) start = end - 1;
  return { step, stage: stageOf(step, home), start: Math.max(0, start), end: Math.max(1, end) };
}

export function axisFrom(steps: PersonStep[]): number {
  const ys = steps.map((s) => s.start_year).filter((y): y is number => y != null);
  return ys.length ? Math.min(...ys) : NOW_YEAR - 6;
}

const fmtYears = (y?: number | null) => (y == null ? null : `${Number.isInteger(y) ? y : y.toFixed(1)} yr${y === 1 ? "" : "s"}`);
const span = (s: PersonStep) => `${s.start_year ?? "?"}–${s.end_year ?? "now"}`;

function BandCells({ band, cols, highlight }: { band: Band; cols: number; highlight: boolean }) {
  const part = band.stage === "intern";
  return (
    <>
      {Array.from({ length: band.end - band.start }, (_, i) => {
        const col = band.start + i;
        if (col >= cols) return null;
        const checker = part && i % 2 === 1;
        return (
          <span key={col} className={styles.cellPair} style={{ gridColumn: `${col + 1}` }} aria-hidden="true">
            {[0, 1].map((r) => (
              <i
                key={r}
                className={[styles.cell, (checker ? r === 0 : part && r === 1) && styles.hollowCell, highlight && styles.hiCell].filter(Boolean).join(" ")}
                style={{ ["--c" as string]: stageToken(band.stage) } as CSSProperties}
              />
            ))}
          </span>
        );
      })}
    </>
  );
}

export function CareerTimeline({ steps, highlightIndex }: { steps: PersonStep[]; highlightIndex?: number }) {
  const ordered = [...steps].sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0) || (a.end_year ?? 9999) - (b.end_year ?? 9999));
  const from = axisFrom(ordered);
  const home = homeCountry(ordered);
  const cols = (NOW_YEAR - from + 1) * 2;
  const nowCol = (NOW_YEAR - from) * 2 + NOW_HALF;
  const bands = ordered.map((s) => bandOf(s, from, home)).filter((b): b is Band => !!b);
  const hi = highlightIndex ?? bands.length - 1;
  const firstAbroad = bands.find((b) => b.step.country && b.step.country !== home);
  const moveCol = firstAbroad?.start ?? null;
  const used = new Set(bands.map((b) => b.stage));
  const gridStyle = { ["--cols" as string]: cols } as CSSProperties;

  // Country track: home until the move, abroad after.
  const homeCities = [...new Set(bands.filter((b) => !b.step.country || b.step.country === home).map((b) => b.step.city).filter(Boolean))];
  const awayCities = [...new Set(bands.filter((b) => b.step.country && b.step.country !== home).map((b) => b.step.city).filter(Boolean))];
  const homeYears = moveCol != null ? moveCol / 2 : cols / 2;
  const awayYears = moveCol != null ? (nowCol + 1 - moveCol) / 2 : 0;

  return (
    <div className={styles.wrap}>
      <ul className={styles.legend} aria-label="Stage colours">
        {STAGES.filter((s) => used.has(s.id)).map((s) => (
          <li key={s.id}>
            {s.id === "intern" ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={styles.swatchPart} style={{ ["--c" as string]: s.token } as CSSProperties}>
                <rect x="0.75" y="0.75" width="10.5" height="10.5" />
                <rect x="0" y="0" width="6" height="6" className={styles.swatchFill} />
                <rect x="6" y="6" width="6" height="6" className={styles.swatchFill} />
              </svg>
            ) : (
              <i className={styles.swatch} style={{ ["--c" as string]: s.token } as CSSProperties} aria-hidden="true" />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <div className={styles.scroller}>
        <div className={styles.grid} style={gridStyle} role="img" aria-label={`Career path from ${from} to today: ${ordered.map((s) => `${s.org}${s.title ? `, ${s.title}` : ""}, ${span(s)}`).join("; ")}.`}>
          <div className={styles.years} aria-hidden="true">
            {Array.from({ length: cols / 2 }, (_, i) => (
              <span key={i} style={{ gridColumn: `${i * 2 + 1} / span 2` }}>
                {from + i}
              </span>
            ))}
            <span className={styles.todayTag} style={{ gridColumn: `${nowCol + 1}` }}>
              Today
            </span>
          </div>

          {bands.map((b, i) => {
            const highlight = i === hi;
            const labelLeft = b.start >= 6;
            const meta = [[b.step.city, b.step.country].filter(Boolean).join(", "), span(b.step), fmtYears(b.step.years)].filter(Boolean).join(" · ");
            return (
              <div key={`${b.step.org}-${i}`} className={[styles.band, highlight && styles.hiBand].filter(Boolean).join(" ")} aria-hidden="true">
                <BandCells band={b} cols={cols} highlight={highlight} />
                <span
                  className={[styles.label, labelLeft ? styles.labelLeft : styles.labelRight].join(" ")}
                  style={{ gridColumn: labelLeft ? `1 / ${b.start + 1}` : `${Math.min(cols, b.end + 1)} / ${cols + 1}` }}
                >
                  <span>
                    <strong>{b.step.org}</strong>
                    {b.step.title && <> · {b.step.title}</>}
                  </span>
                  <small>{meta}</small>
                </span>
                {firstAbroad === b && moveCol != null && (
                  <span className={styles.moveTag} style={{ gridColumn: `${moveCol + 1} / span 6` }}>
                    Moved {home} → {b.step.country} · {b.step.start_year}
                  </span>
                )}
              </div>
            );
          })}

          <div className={styles.track} aria-hidden="true">
            <span className={styles.trackLabel} style={{ gridColumn: `1 / ${(moveCol ?? cols) + 1}` }}>
              <strong>{home}</strong> · {homeCities.join(", ")} · {from}–{moveCol != null ? from + moveCol / 2 : "today"} · {fmtYears(homeYears)}
            </span>
            {moveCol != null && (
              <span className={styles.trackLabel} style={{ gridColumn: `${moveCol + 1} / ${cols + 1}` }}>
                <strong>{firstAbroad?.step.country}</strong> · {awayCities.join(", ")} · {from + moveCol / 2}–today · {fmtYears(awayYears)}
              </span>
            )}
            {Array.from({ length: Math.min(cols, nowCol + 1) }, (_, c) => (
              <i key={c} className={moveCol != null && c >= moveCol ? styles.trackAway : styles.trackHome} style={{ gridColumn: `${c + 1}` }} />
            ))}
          </div>

          {moveCol != null && <span className={styles.moveLine} style={{ gridColumn: `${moveCol + 1}` }} aria-hidden="true" />}
          <span className={styles.todayLine} style={{ gridColumn: `${nowCol + 1}` }} aria-hidden="true" />
        </div>
      </div>
      <p className={styles.caption}>One column is half a year. Years only, rounded to the half year. Highlighted: the role you opened.</p>
    </div>
  );
}
