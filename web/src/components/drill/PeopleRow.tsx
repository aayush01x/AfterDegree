"use client";
// Anonymous career paths behind a count, as a row of person tiles; or the "too few people" state.
import type { PersonCard } from "@/lib/drill-types";
import { TileRow } from "@/components/tiles/TileRow";
import { PersonTile } from "@/components/tiles/PersonTile";
import { StageLegend } from "@/components/tiles/StageLegend";
import { EmptyState } from "@/components/data/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./Drill.module.css";

export interface PeopleRowProps {
  title: string;
  people: PersonCard[];
  total?: number;
  note?: string;
  blockedReason?: string | null;
  /** Where to send the user when the slice is too small to list (the level above). */
  upHref?: string;
  upLabel?: string;
  example?: boolean;
}

/** Year span shared by every tile, so their strips line up. */
function span(people: PersonCard[]): [number, number] {
  const ys = people.flatMap((p) => p.steps.flatMap((s) => [s.start_year, s.end_year])).filter((y): y is number => typeof y === "number");
  const now = new Date().getFullYear();
  if (!ys.length) return [now - 8, now];
  return [Math.max(Math.min(...ys), now - 9), now];
}

export function PeopleRow({ title, people, total, note, blockedReason, upHref, upLabel, example }: PeopleRowProps) {
  if (blockedReason || people.length === 0) {
    return (
      <section className={styles.block} aria-labelledby="people-title">
        <h2 id="people-title" className={styles.rowTitle}>
          {title}
        </h2>
        <EmptyState
          tone="field"
          title={blockedReason ?? "No career paths to show here yet"}
          actions={
            upHref ? (
              <ButtonLink href={upHref} variant="secondary">
                {upLabel ?? "Go up one level"}
              </ButtonLink>
            ) : undefined
          }
        >
          {blockedReason
            ? `${total != null ? `${total} ${total === 1 ? "person matches" : "people match"} here. ` : ""}Paths this narrow could point at someone, so we show the count only. Go up a level, or drop a filter, to see the paths behind it.`
            : "None of the people counted here have enough public history to draw a path. The counts above still stand."}
        </EmptyState>
      </section>
    );
  }
  const [from, to] = span(people);
  const shown = note ?? `${people.length} of ${total ?? people.length} shown, anonymised`;
  return (
    <TileRow title={title} note={shown} count={<StageLegend />} example={example} label={`${title}: anonymised career paths`}>
      {people.map((p, i) => (
        <PersonTile key={p.id} person={p} expanded={i === 0} from={from} to={to} openLabel={i === 0 ? "Open full career path" : "View path"} />
      ))}
    </TileRow>
  );
}
