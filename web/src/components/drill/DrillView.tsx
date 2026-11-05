"use client";
// A drill level that is not a company: headline count, the "where" visual, the next-level
// breakdowns as tile rows, the anonymous people behind the count, and the next step.
import type { DrillResultFull, DrillToken } from "@/lib/drill-types";
import { GridNumber } from "@/components/data/GridNumber";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { SectionView } from "@/components/data/ResultView";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { DrillHeader } from "./DrillHeader";
import { WherePanel } from "./WherePanel";
import { BreakdownTiles } from "./BreakdownTiles";
import { PeopleRow } from "./PeopleRow";
import { DrillFooter } from "./DrillFooter";
import { drillHref, tokenAtLevel } from "./token";
import { isBreakdown, isExample } from "./rows";
import styles from "./Drill.module.css";

export function HeadlineCount({ k, n, of }: { k: number; n?: number; of?: string }) {
  return (
    <div className={styles.count}>
      <GridNumber value={k} cell={32} label={`at least ${k}${n != null ? ` of ${n}` : ""}`} />
      <div className={styles.countSide} aria-hidden="true">
        <span className={styles.atLeast}>at least</span>
        {n != null && (
          <span className={styles.countOf}>
            of {of ? `the ${n} ${of}` : n}
          </span>
        )}
      </div>
    </div>
  );
}

export function DrillView({ token, result }: { token: DrillToken; result: DrillResultFull }) {
  const example = isExample(result.evidence);
  const path = result.path?.length ? result.path : token.path;
  const last = path[path.length - 1];
  const place = last?.label ?? result.title;
  const k = result.count?.k ?? result.people_total ?? result.cohort?.n_visible ?? 0;
  const breakdowns = result.sections.filter(isBreakdown);
  const others = result.sections.filter((s) => !isBreakdown(s));
  const firstCity = breakdowns.find((s) => s.id === "cities");
  const nextHint = firstCity && firstCity.kind === "ranked_table" ? String(firstCity.data.rows[0]?.cells.city ?? "") : null;
  const up = path.length > 1 ? tokenAtLevel({ ...token, path }, path.length - 1) : null;

  return (
    <div className={styles.page}>
      <DrillHeader
        token={token}
        context={result.context}
        path={path}
        next={nextHint}
        aside={<EvidenceKey n={k} coverage={result.coverage ?? null} date={result.data_date} evidence={result.evidence} boxed />}
        note={result.context ? `Showing only people matching your filters from ${result.context.origin_label}.` : undefined}
      />

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <HeadlineCount k={k} n={result.count?.n} of={result.count_label} />
          <h1 className={styles.title}>
            {result.title}
            {example && <ExampleBadge force />}
          </h1>
          {result.summary && <p className={styles.lede}>{result.summary}</p>}
          {result.warnings?.map((w) => (
            <p key={w} className={styles.warning}>
              {w}
            </p>
          ))}
        </div>
        <WherePanel result={result} />
      </div>

      {breakdowns.map((s) => (
        <BreakdownTiles key={s.id} section={s} total={k} example={false} />
      ))}

      <PeopleRow
        title={result.title}
        people={result.people}
        total={result.people_total ?? k}
        note={result.people_note}
        blockedReason={result.listing_blocked_reason}
        upHref={up ? drillHref(up) : undefined}
        upLabel={up ? `See everyone in ${up.path[up.path.length - 1]?.label}` : undefined}
      />

      {others.length > 0 && (
        <div className={styles.panels}>
          {others.map((s) => (
            <SectionView key={s.id} section={s} evidence={result.evidence} />
          ))}
        </div>
      )}

      <DrillFooter steps={result.next_steps} place={place} />
    </div>
  );
}
