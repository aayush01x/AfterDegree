"use client";

import type { DrillToken } from "@/lib/drill-types";
import { RouteArt } from "@/components/art/RouteArt";
import { CellDigits } from "@/components/data/CellDigits";
import { Tag } from "@/components/ui/Tag";
import { fmtInt } from "@/lib/format";
import { TileHit, useTileTarget } from "./TileAction";
import styles from "./RouteTile.module.css";

export interface RouteTileProps {
  /** Steps joined with →. */
  title: string;
  steps?: string[];
  people: number;
  years?: number | null;
  badge?: string;
  hue?: 1 | 2 | 3 | 4;
  drill?: DrillToken | null;
  href?: string;
  onSelect?: () => void;
  className?: string;
}

const about = (y: number) => `about ${Number.isInteger(y) ? y : (Math.round(y * 2) / 2).toFixed(1)} yrs`;

/** A route as a stepped cell path, with how many people took it. */
export function RouteTile({ title, steps, people, years, badge, hue = 1, drill, href, onSelect, className }: RouteTileProps) {
  const target = useTileTarget({ onSelect, drill, drillTitle: title, href });
  const n = Math.max(2, Math.min(5, steps?.length ?? title.split("→").length));
  const meta = `${people === 1 ? "person" : "people"}${years ? ` · ${about(years)}` : ""}`;
  const name = `${title}, ${fmtInt(people)} ${meta}`;
  return (
    <article className={[styles.tile, className].filter(Boolean).join(" ")} data-tile="" aria-label={name}>
      <div className={styles.art}>
        <RouteArt steps={n} hue={hue} seed={title} label={`${n}-step route drawn as a stepped cell path`} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          {target ? (
            <TileHit target={target} className={styles.hit} label={name}>
              {title}
            </TileHit>
          ) : (
            title
          )}
        </h3>
        <p className={styles.meta}>
          <CellDigits value={people} pitch={4} tone="current" label={fmtInt(people)} />
          <span>{meta}</span>
          {badge && <Tag className={styles.badge}>{badge}</Tag>}
        </p>
      </div>
    </article>
  );
}
