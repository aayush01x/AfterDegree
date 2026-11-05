"use client";

import { useState } from "react";

import type { ResultEnvelope, Section } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { CompanyMark } from "@/components/art/CompanyMark";
import { DotTexture } from "@/components/art/DotTexture";
import { drillOf } from "@/components/data/Drillable";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import styles from "./FeederTiles.module.css";

type Table = Extract<Section, { kind: "ranked_table" }>;

/** Where people worked just before: one company tile per feeder employer, each opening the company profile. */
export function FeederTiles({ section, result }: { section: Table; result: ResultEnvelope }) {
  const [active, setActive] = useState(0);
  const rows = section.data.rows;
  const graph = result.sections.find((s): s is Extract<Section, { kind: "routes" }> => s.kind === "routes");
  const rank = rows.filter((r) => !r.rest);
  const rest = rows.find((r) => r.rest);
  const countOf = (r: (typeof rows)[number]) => (typeof r.cells.people === "number" ? r.cells.people : (r.count?.k ?? 0));

  /** The titles people went through on their way, read from the graph's edges (feeder -> title). */
  const wentOn = (name: string) => {
    if (!graph) return [];
    const node = graph.data.nodes.find((n) => n.kind === "employer" && n.label === name);
    if (!node) return [];
    const label = (id: string) => graph.data.nodes.find((n) => n.id === id)?.label ?? id;
    return graph.data.edges
      .filter((e) => e.from === node.id)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((e) => ({ title: label(e.to), count: e.count }));
  };

  if (!rank.length && !rest) return null;
  return (
    <TileRow band dim title={section.title} note={section.data.caption ?? "The employer held just before the position."} count={`${rank.length} ${rank.length === 1 ? "employer" : "employers"}`}>
      {rank.map((r, i) => {
        const name = String(r.cells.employer ?? "");
        const n = countOf(r);
        const steps = wentOn(name);
        return (
          <PosterTile
            key={r.id ?? name}
            variant="card"
            tone="band"
            expanded={i === active}
            onSelect={i === active ? undefined : () => setActive(i)}
            title={name}
            art={<CompanyMark name={name} shape="landscape" />}
            count={n}
            unit={n === 1 ? "person" : "people"}
            badge={r.you ? "Your employer" : undefined}
            drill={drillOf(r)}
            drillLabel={`Open ${name}`}
            details={
              steps.length ? (
                <dl className={styles.went}>
                  <dt>Went on as</dt>
                  {steps.map((s) => (
                    <dd key={s.title}>
                      <span>{s.title}</span>
                      <b>{fmtInt(s.count)}</b>
                    </dd>
                  ))}
                </dl>
              ) : undefined
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
          count={countOf(rest)}
          unit="people"
          note="Counts only"
        />
      )}
    </TileRow>
  );
}
