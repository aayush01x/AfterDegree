"use client";
// One next-level breakdown (cities, companies, roles…) as a row of poster tiles. The biggest
// group is expanded with its peek (top companies / roles); every tile opens its own drill.
import type { ReactNode } from "react";
import type { Section } from "@/lib/types";
import { TileRow } from "@/components/tiles/TileRow";
import { PosterTile } from "@/components/tiles/PosterTile";
import { PlaceArt } from "@/components/art/PlaceArt";
import { CompanyMark } from "@/components/art/CompanyMark";
import { RouteArt } from "@/components/art/RouteArt";
import { dimOf, plural, rowsOf, type BreakdownRow } from "./rows";
import styles from "./BreakdownTiles.module.css";

const LISTABLE = 5;

function artFor(row: BreakdownRow, expanded: boolean): ReactNode {
  const dim = dimOf(row);
  const shape = expanded ? "portrait" : "landscape";
  if (row.rest || /^elsewhere|^other/i.test(row.label)) return <PlaceArt place="Elsewhere" shape="landscape" label="Everywhere else" />;
  if (dim === "city" || dim === "country" || dim === "degree_country") return <PlaceArt place={row.label} shape={shape} />;
  if (dim === "company" || dim === "posting_employer") return <CompanyMark name={row.label} shape={expanded ? "square" : "landscape"} />;
  const hue = ((row.label.length % 4) + 1) as 1 | 2 | 3 | 4;
  return <RouteArt seed={row.label} hue={hue} steps={3} cols={expanded ? 24 : 20} rows={12} label={`${row.label}, drawn as a stepped path`} />;
}

function Peek({ row }: { row: BreakdownRow }) {
  if (!row.preview?.length) return null;
  return (
    <div className={styles.peek}>
      {row.preview.map((g) => (
        <dl key={g.label} className={styles.peekGroup}>
          <dt>{g.label}</dt>
          {g.items.map((it) => (
            <dd key={it.label}>
              <span>{it.label}</span>
              <span className={styles.num}>{it.count}</span>
            </dd>
          ))}
        </dl>
      ))}
    </div>
  );
}

export interface BreakdownTilesProps {
  section: Section;
  total: number;
  note?: ReactNode;
  example?: boolean;
}

export function BreakdownTiles({ section, total, note, example }: BreakdownTilesProps) {
  const rows = rowsOf(section).filter((r) => r.count > 0);
  if (!rows.length) return null;
  const first = rows.findIndex((r) => !r.rest && r.drill);
  const caption = note ?? (section.kind === "ranked_table" ? section.data.caption : section.kind === "distribution" ? section.data.caption : undefined);
  const unit = section.id === "cities" ? plural(rows.length, "city", "cities") : plural(rows.length, "group");
  return (
    <TileRow title={section.title} note={caption} count={`${rows.length} ${unit}`} example={example} dim>
      {rows.map((row, i) => {
        const expanded = i === first;
        const few = row.count < LISTABLE;
        const lead = i === 0 && !row.rest;
        return (
          <PosterTile
            key={row.key}
            title={row.label}
            art={artFor(row, expanded)}
            count={row.count}
            unit={plural(row.count, "person", "people")}
            variant={expanded ? "wide" : "card"}
            expanded={expanded}
            badge={expanded && lead ? "the biggest group" : undefined}
            note={!expanded && few ? "Counts only" : undefined}
            countLine={expanded ? `at least ${row.count} of ${total}` : undefined}
            details={expanded ? <Peek row={row} /> : undefined}
            drill={row.drill ?? null}
            drillLabel={`See the ${row.count} ${dimOf(row) === "company" ? "at" : "in"} ${row.label}`}
            tone="paper"
          />
        );
      })}
    </TileRow>
  );
}
