"use client";

import { useState } from "react";

import type { ResultEnvelope, Section } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { CompanyMark } from "@/components/art/CompanyMark";
import { DotTexture } from "@/components/art/DotTexture";
import { drillOf } from "@/components/data/Drillable";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import { signalOf, type HireSignal } from "./EmployersTable";
import styles from "./EmployerTiles.module.css";

type Table = Extract<Section, { kind: "ranked_table" }>;

const BADGE: Record<HireSignal, string> = { high: "High", some: "Some", unclear: "Unclear" };
const NOTE: Record<HireSignal, string> = {
  high: "Postings here have often been followed by matching hires.",
  some: "Some matching hires seen after postings.",
  unclear: "No matching hires seen yet.",
};

/** Employers posting the most, as company tiles. Each opens the company profile, which carries the hiring detail. */
export function EmployerTiles({ section }: { section: Table; result?: ResultEnvelope }) {
  const [active, setActive] = useState(0);
  const rank = section.data.rows.filter((r) => !r.rest);
  const rest = section.data.rows.find((r) => r.rest);
  if (!rank.length && !rest) return null;
  return (
    <TileRow band dim title="Who posts the most" note="Employers with the most postings. The badge is the hire-through signal. Open one for its hiring detail." count={`${rank.length} ${rank.length === 1 ? "employer" : "employers"}`}>
      {rank.map((r, i) => {
        const name = String(r.cells.employer ?? "");
        const postings = Number(r.cells.postings ?? 0);
        const hires = Number(r.cells.hires ?? 0);
        const sig = signalOf(r);
        return (
          <PosterTile
            key={r.id ?? name}
            variant="card"
            tone="band"
            expanded={i === active}
            onSelect={i === active ? undefined : () => setActive(i)}
            title={name}
            art={<CompanyMark name={name} shape="landscape" />}
            count={postings}
            unit={postings === 1 ? "posting" : "postings"}
            badge={BADGE[sig]}
            drill={drillOf(r)}
            drillLabel={`Open ${name}`}
            details={
              <p className={styles.read}>
                Hire-through {BADGE[sig].toLowerCase()}. {NOTE[sig]} <b>{fmtInt(hires)}</b> matching {hires === 1 ? "hire" : "hires"} seen.
              </p>
            }
          />
        );
      })}
      {rest && (
        <PosterTile
          variant="card"
          tone="band"
          title="Other employers"
          art={<DotTexture />}
          count={Number(rest.cells.postings ?? 0)}
          unit="postings"
          note="Counts only"
        />
      )}
    </TileRow>
  );
}
