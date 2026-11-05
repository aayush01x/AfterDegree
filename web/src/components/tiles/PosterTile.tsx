"use client";

import type { ReactNode } from "react";
import type { DrillToken } from "@/lib/drill-types";
import { CellDigits } from "@/components/data/CellDigits";
import { Chevron } from "@/components/ui/Chevron";
import { Tag } from "@/components/ui/Tag";
import { fmtInt } from "@/lib/format";
import { TileHit, useTileTarget } from "./TileAction";
import styles from "./PosterTile.module.css";

export interface PosterTileProps {
  title: string;
  art: ReactNode;
  /** Art used when expanded (e.g. a wide scene); defaults to `art`. */
  expandedArt?: ReactNode;
  count?: number;
  /** Unit after the count ("people", "of 14"). */
  unit?: string;
  badge?: string;
  /** poster: tall art (destinations); card: paper card with landscape art (companies, cities); wide: landscape. */
  variant?: "poster" | "card" | "wide";
  expanded?: boolean;
  /** Expanded body slot (top cities, employers, typical route…). */
  details?: ReactNode;
  /** Expanded count line, e.g. "at least 71 of 312 people like you"; the count is drawn in cells. */
  countLine?: ReactNode;
  drill?: DrillToken | null;
  /** Expanded drill button text, e.g. "See the 71 people". */
  drillLabel?: string;
  href?: string;
  /** Choosing a collapsed tile (e.g. expand it in its row). Takes priority over drill/href. */
  onSelect?: () => void;
  /** Small note on the art, e.g. "Counts only". */
  note?: string;
  tone?: "paper" | "band";
  className?: string;
}

/** Splits "at least 71 of 312 people like you" around the count so the count can be cell-built. */
function CountLine({ line, count }: { line: ReactNode; count?: number }) {
  if (typeof line !== "string" || count == null) return <span className={styles.lineText}>{line}</span>;
  const n = fmtInt(count);
  const i = line.indexOf(n);
  if (i < 0)
    return (
      <>
        <CellDigits value={count} pitch={5} tone="current" />
        <span className={styles.lineText}>{line}</span>
      </>
    );
  return (
    <>
      {line.slice(0, i).trim() && <span className={styles.lineText}>{line.slice(0, i).trim()}</span>}
      <CellDigits value={count} pitch={5} tone="current" label={n} />
      {line.slice(i + n.length).trim() && <span className={styles.lineText}>{line.slice(i + n.length).trim()}</span>}
    </>
  );
}

/** A poster tile: cell art, a title and a cell-digit count; expanded it shows details and its drill action. */
export function PosterTile({
  title,
  art,
  expandedArt,
  count,
  unit = "people",
  badge,
  variant = "poster",
  expanded = false,
  details,
  countLine,
  drill,
  drillLabel,
  href,
  onSelect,
  note,
  tone = "paper",
  className,
}: PosterTileProps) {
  const choose = useTileTarget({ onSelect, drill, drillTitle: title, href });
  const open = useTileTarget({ drill, drillTitle: title, href });
  const pitch = variant === "poster" ? 5 : 3;
  const cls = [styles.tile, styles[variant], tone === "band" && styles.band, expanded && styles.expanded, className].filter(Boolean).join(" ");
  const countText = count != null ? `${fmtInt(count)} ${unit}` : "";

  if (expanded) {
    return (
      <article className={cls} data-tile="" data-expanded="" aria-label={`${title}${countText ? `, ${countText}` : ""}`}>
        <div className={styles.art}>{expandedArt ?? art}</div>
        {badge && <Tag className={styles.badge}>{badge}</Tag>}
        {note && <Tag tone="paper" className={styles.note}>{note}</Tag>}
        <div className={styles.body}>
          <h3 className={styles.title}>{title}</h3>
          {(countLine || count != null) && (
            <p className={styles.line}>
              {countLine ? (
                <CountLine line={countLine} count={count} />
              ) : (
                <>
                  <CellDigits value={count!} pitch={5} tone="current" />
                  <span className={styles.lineText}>{unit}</span>
                </>
              )}
            </p>
          )}
          {details && <div className={styles.details}>{details}</div>}
          {open && (
            <TileHit target={open} className={styles.go}>
              <span>{drillLabel ?? (count != null ? `See the ${fmtInt(count)} ${unit}` : `Open ${title}`)}</span>
              <Chevron />
            </TileHit>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={cls} data-tile="" aria-label={`${title}${countText ? `, ${countText}` : ""}`}>
      <div className={styles.art}>{art}</div>
      {badge && <Tag className={styles.badge}>{badge}</Tag>}
      {note && <Tag tone="paper" className={styles.note}>{note}</Tag>}
      <div className={styles.body}>
        <h3 className={styles.title}>
          {choose ? (
            <TileHit target={choose} className={styles.hit} label={`${title}${countText ? `, ${countText}` : ""}`}>
              {title}
            </TileHit>
          ) : (
            title
          )}
        </h3>
        {count != null && (
          <p className={styles.count}>
            <CellDigits value={count} pitch={pitch} tone="current" label={fmtInt(count)} />
            <span>{unit}</span>
          </p>
        )}
      </div>
    </article>
  );
}
