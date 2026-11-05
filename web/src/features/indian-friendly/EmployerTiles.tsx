"use client";

import { useState } from "react";

import { fmtInt } from "@/lib/format";
import { CompanyMark } from "@/components/art/CompanyMark";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import type { DrillToken } from "@/lib/drill-types";
import styles from "./EmployerTiles.module.css";

export interface TileEmployer {
  id: string;
  name: string;
  hires: number;
  recent: number;
  tenure: number | null;
  signals: string[];
  cities: string[];
  drill: DrillToken | null;
}

/** The employers with the most Indian-educated hires, as company tiles. Each opens the company profile. */
export function EmployerTiles({ employers, country }: { employers: TileEmployer[]; per?: number; country: string | null }) {
  const [active, setActive] = useState(0);
  if (!employers.length) return null;
  return (
    <TileRow
      band
      dim
      title="Where they were hired"
      note={`${country ? `Employers in ${country}` : "Employers"} with the most people who studied in India. Open one for its company profile.`}
      count={`${employers.length} ${employers.length === 1 ? "employer" : "employers"}`}
    >
      {employers.map((e, i) => (
        <PosterTile
          key={e.id}
          variant="card"
          tone="band"
          expanded={i === active}
          onSelect={i === active ? undefined : () => setActive(i)}
          title={e.name}
          art={<CompanyMark name={e.name} shape="landscape" />}
          count={e.hires}
          unit={e.hires === 1 ? "person" : "people"}
          badge={e.signals.length ? "Visa signal" : undefined}
          drill={e.drill}
          drillLabel={`Open ${e.name}`}
          details={
            <p className={styles.read}>
              <b>{fmtInt(e.recent)}</b> started in the last 24 months
              {e.tenure !== null ? `, median stay ${e.tenure.toFixed(1)} years` : ""}.{e.cities.length ? ` ${e.cities.slice(0, 3).join(", ")}.` : ""}
              {e.signals[0] ? ` ${e.signals[0]}.` : ""}
            </p>
          }
        />
      ))}
    </TileRow>
  );
}
