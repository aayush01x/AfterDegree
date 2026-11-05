"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Evidence } from "@/lib/types";
import { fmtInt, fmtPct, formatDate } from "@/lib/format";
import styles from "./EvidenceKey.module.css";

const ENDPOINT_NAMES: Record<string, string> = {
  "/person/search": "Profile search",
  "/person/enrich": "Your profile",
  "/job/search": "Job posting search",
  "/company/search": "Company search",
  "/company/enrich": "Company details",
  "/company/identify": "Company match",
  "/web/search": "Web search",
  "/web/fetch": "Web page",
};

export interface EvidenceKeyProps {
  n?: number;
  /** Share of profiles that carry the field being counted (0..1). */
  coverage?: number | null;
  /** ISO date of the data. */
  date?: string;
  /** Replace the generated text, e.g. "n = 214 abroad". */
  label?: string;
  evidence?: Evidence[];
  /** Plain-English coverage note shown in the drawer. */
  note?: string;
  /** Draw the key in a white box (for use on the orange field). */
  boxed?: boolean;
  /** "ink" renders a plain underlined ink link, for use directly on the orange field. */
  tone?: "blue" | "ink";
}

export function evidenceText(n?: number, coverage?: number | null, date?: string) {
  return [n !== undefined && `N = ${fmtInt(n)}`, coverage != null && `${fmtPct(coverage)} coverage`, date && formatDate(date)]
    .filter(Boolean)
    .join(" · ");
}

/** The blue evidence key. Opens a drawer with what the numbers rest on. */
export function EvidenceKey({ n, coverage, date, label, evidence = [], note, boxed = false, tone = "blue" }: EvidenceKeyProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const text = label ?? evidenceText(n, coverage, date);

  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={[styles.key, boxed && styles.boxed, tone === "ink" && styles.ink].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {text}
        <span className="visually-hidden">: show the evidence</span>
      </button>
      {open &&
        createPortal(
      <dialog
        ref={ref}
        className={styles.drawer}
        aria-label="Evidence"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className={styles.inner}>
          <div className={styles.top}>
            <h2>What this rests on</h2>
            <button type="button" className={styles.close} onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
          <dl className={styles.summary}>
            <div>
              <dt>People counted</dt>
              <dd>{n !== undefined ? fmtInt(n) : "–"}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{coverage != null ? fmtPct(coverage) : "–"}</dd>
            </div>
            <div>
              <dt>Data date</dt>
              <dd>{date ? formatDate(date).replace(/ \d{4}$/, "") : "–"}</dd>
            </div>
          </dl>
          {note && <p className={styles.note}>{note}</p>}
          {evidence.length > 0 && (
            <ul role="list" className={styles.list}>
              {evidence.map((e) => (
                <li key={e.id} className={styles.item}>
                  <h3>{ENDPOINT_NAMES[e.endpoint] ?? e.endpoint}</h3>
                  <dl className={styles.facts}>
                    <dt>Matched</dt>
                    <dd>{fmtInt(e.total_count)} records</dd>
                    <dt>Used</dt>
                    <dd>{fmtInt(e.results_used)}</dd>
                    <dt>Fetched</dt>
                    <dd>
                      {formatDate(e.fetched_at)} ({e.source === "cache" ? "saved copy" : e.source === "mock" ? "example data" : "live"})
                    </dd>
                    {Object.entries(e.filters ?? {}).map(([k, v]) => (
                      <FilterRow key={k} k={k} v={v} />
                    ))}
                  </dl>
                  {e.note && <p className={styles.method}>{e.note}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.method}>
            Every count is a lower bound: people without a public profile, or whose profile leaves the field blank, are not counted. No
            individual is ever shown.
          </p>
        </div>
      </dialog>,
          document.body,
        )}
    </>
  );
}

function FilterRow({ k, v }: { k: string; v: unknown }) {
  const value = Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  return (
    <>
      <dt>{k.replace(/_/g, " ")}</dt>
      <dd>{value}</dd>
    </>
  );
}
