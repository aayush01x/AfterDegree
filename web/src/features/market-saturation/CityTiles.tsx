"use client";

import { useState } from "react";

import type { Section } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { PlaceArt } from "@/components/art/PlaceArt";
import { drillOf } from "@/components/data/Drillable";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import styles from "./CityTiles.module.css";

type Table = Extract<Section, { kind: "ranked_table" }>;

/** Comparable cities as city tiles. The count is newcomers like you; the ratio sits in the expanded detail. */
export function CityTiles({ section, ratioLabel }: { section: Table; ratioLabel: string }) {
  const [active, setActive] = useState(0);
  const rows = section.data.rows.filter((r) => !r.rest);
  if (!rows.length) return null;
  const ordered = [...rows].sort((a, b) => Number(b.you ?? false) - Number(a.you ?? false));
  return (
    <TileRow band dim title="Comparable cities" note="Newcomers like you in the last 12 months. Open a city to see them." count={`${rows.length} ${rows.length === 1 ? "city" : "cities"}`}>
      {ordered.map((r, i) => {
        const city = String(r.cells.city ?? "");
        const entrants = Number(r.cells.entrants ?? 0);
        const openings = Number(r.cells.openings ?? 0);
        const ratio = Number(r.cells.ratio);
        const shown = Number.isFinite(ratio) ? (ratio < 1 ? `${Math.round(ratio * 100)}` : ratio.toFixed(1)) : null;
        return (
          <PosterTile
            key={r.id ?? city}
            variant="card"
            tone="band"
            expanded={i === active}
            onSelect={i === active ? undefined : () => setActive(i)}
            title={city}
            art={<PlaceArt place={city} shape="landscape" />}
            count={entrants}
            unit={entrants === 1 ? "newcomer" : "newcomers"}
            badge={r.you ? "Your city" : undefined}
            note={entrants < 5 ? "Counts only" : undefined}
            drill={drillOf(r)}
            drillLabel={`See the newcomers in ${city}`}
            details={
              <p className={styles.read}>
                {shown !== null && (
                  <>
                    <b>{shown}</b> {ratioLabel}.{" "}
                  </>
                )}
                {fmtInt(openings)} openings a year.
              </p>
            }
          />
        );
      })}
    </TileRow>
  );
}
