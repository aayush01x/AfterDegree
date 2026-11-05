"use client";
// The "where" visual beside the headline: a cell map with count markers for a country, or a
// cell list of the next level for a city, company or role. Every row opens its own drill.
import { useState } from "react";
import type { DrillResultFull } from "@/lib/drill-types";
import { CountryMap } from "@/components/art/CountryMap";
import { CellDigits } from "@/components/data/CellDigits";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { useDrill } from "./useDrill";
import { rowsOf, type BreakdownRow } from "./rows";
import styles from "./WherePanel.module.css";

const LISTABLE = 5;

function pickSection(result: DrillResultFull) {
  const dim = result.path[result.path.length - 1]?.dimension;
  const order = dim === "country" ? ["cities"] : dim === "city" ? ["companies", "roles"] : dim === "role" ? ["cities", "companies"] : ["cities", "companies", "roles"];
  for (const id of order) {
    const s = result.sections.find((x) => x.id === id);
    if (s && rowsOf(s).length) return s;
  }
  return result.sections.find((s) => rowsOf(s).some((r) => r.drill));
}

export function WherePanel({ result }: { result: DrillResultFull }) {
  const drill = useDrill();
  const section = pickSection(result);
  const rows = section ? rowsOf(section).filter((r) => r.count > 0) : [];
  const [focus, setFocus] = useState<string | null>(null);
  if (!section || rows.length === 0) return null;

  const last = result.path[result.path.length - 1];
  const isCountry = last?.dimension === "country";
  const place = last?.label ?? "this group";
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(...rows.map((r) => r.count));
  const active = focus ?? rows.find((r) => !r.rest)?.key ?? rows[0].key;
  const by = section.id === "cities" ? "by current city" : section.id === "companies" ? "by employer" : "by role";
  const open = (r: BreakdownRow) => r.drill && drill.open(r.drill, r.label);

  const list = (
    <ul className={styles.list} aria-label={`${section.title} in ${place}`}>
      {rows.map((r) => {
        const selected = r.key === active;
        const inner = (
          <>
            <span className={styles.rowHead}>
              <span className={styles.rowLabel}>{r.label}</span>
              <CellDigits value={r.count} pitch={3} font="3x5" label={`${r.count} people`} />
            </span>
            <span className={styles.cells} aria-hidden="true">
              {Array.from({ length: r.count }, (_, i) => (
                <i key={i} />
              ))}
              {r.count < LISTABLE && <em className={styles.few}>too few to list people</em>}
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.drill ? (
              <button
                type="button"
                className={[styles.row, selected && styles.selected].filter(Boolean).join(" ")}
                onMouseEnter={() => setFocus(r.key)}
                onFocus={() => setFocus(r.key)}
                onClick={() => open(r)}
                aria-label={`${r.label}: ${r.count} people. Open this group`}
              >
                {inner}
              </button>
            ) : (
              <div className={[styles.row, styles.static].join(" ")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className={styles.panel} aria-labelledby="where-title">
      <header className={styles.head}>
        <h2 id="where-title" className={styles.title}>
          Where in {place}
        </h2>
        <EvidenceKey label={`N = ${total} · ${by}`} evidence={result.evidence} />
      </header>
      {isCountry ? (
        <div className={styles.mapBody}>
          <div className={styles.map}>
            <CountryMap
              country={last.value}
              cell={16}
              label={`Map of ${place} built from grid cells; markers show how many people live in each city.`}
              markers={rows
                .filter((r) => !r.rest)
                .map((r) => ({
                  label: r.label,
                  count: r.count,
                  listable: r.count >= LISTABLE,
                  selected: r.key === active,
                  onSelect: r.drill ? () => open(r) : undefined,
                }))}
            />
          </div>
          <div className={styles.side}>
            {list}
            <p className={styles.hint}>Marker size follows the count. Pick a city to go one level deeper.</p>
          </div>
        </div>
      ) : (
        <div className={styles.listBody}>{list}</div>
      )}
      <footer className={styles.foot}>
        {isCountry ? <span>{/germany/i.test(last.value) ? "Each map square is about 35 km." : "The map is a sketch, not to scale."}</span> : <span>One square is one person.</span>}
        <span>
          {max < LISTABLE ? "Every group here is under 5 people, so counts only." : "Groups under 5 people show counts only."}
        </span>
      </footer>
    </section>
  );
}
