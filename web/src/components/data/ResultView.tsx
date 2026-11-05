"use client";

import type { Evidence, ResultEnvelope, Section } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import { ButtonLink } from "@/components/ui/Button";
import { CohortWaffle } from "./CohortWaffle";
import { Distribution } from "./Distribution";
import { EvidenceKey } from "./EvidenceKey";
import { KeywordList } from "./KeywordList";
import { Panel } from "./Panel";
import { RankedTable } from "./RankedTable";
import { RouteList } from "./RouteList";
import { RoutesGraph } from "./RoutesGraph";
import { Stat } from "./Stat";
import { TextBlock } from "./TextBlock";
import { Timeseries } from "./Timeseries";
import styles from "./ResultView.module.css";

/** Coverage share for a result: an optional numeric `coverage`, else a percentage in the coverage note. */
export function coverageOf(result: ResultEnvelope): number | null {
  const explicit = (result as ResultEnvelope & { coverage?: number }).coverage;
  if (typeof explicit === "number") return explicit;
  const m = /(\d{1,3})%/.exec(result.coverage_note ?? "");
  return m ? Number(m[1]) / 100 : null;
}

export function sectionEvidence(section: Section, evidence: Evidence[] = []): Evidence[] {
  if (!section.evidence_ids?.length) return evidence;
  const picked = evidence.filter((e) => section.evidence_ids!.includes(e.id));
  return picked.length ? picked : evidence;
}

export function sectionN(section: Section): number | undefined {
  switch (section.kind) {
    case "distribution":
    case "ranked_table":
    case "keywords":
      return section.data.n;
    case "stat":
      return section.data.count?.n ?? undefined;
    default:
      return undefined;
  }
}

const WIDE = new Set(["routes", "route_list", "timeseries"]);
const isWide = (s: Section) =>
  WIDE.has(s.kind) || (s.kind === "ranked_table" && (s.data.columns?.length ?? 0) > 3) || (s.kind === "keywords" && (s.data.items?.length ?? 0) > 8);

/** The body of one section, dispatched by kind. */
export function SectionBody({ section }: { section: Section }) {
  switch (section.kind) {
    case "distribution":
      return section.data.unit === "people" ? (
        <CohortWaffle items={section.data.items ?? []} n={section.data.n} unit="people" label={section.title} />
      ) : (
        <Distribution data={section.data} />
      );
    case "ranked_table":
      return <RankedTable data={section.data} maxRows={12} />;
    case "routes":
      return <RoutesGraph data={section.data} />;
    case "route_list":
      return <RouteList data={section.data} />;
    case "timeseries":
      return <Timeseries data={section.data} />;
    case "stat":
      return <Stat data={section.data} />;
    case "text":
      return <TextBlock data={section.data} />;
    case "keywords":
      return <KeywordList data={section.data} />;
    default: {
      const s = section as { kind?: string };
      return <p className={styles.unknown}>This part of the result ({String(s.kind)}) can&apos;t be shown yet.</p>;
    }
  }
}

/** One section in a white panel with its evidence key. */
export function SectionView({ section, evidence, result, className }: { section: Section; evidence?: Evidence[]; result?: ResultEnvelope; className?: string }) {
  const ev = sectionEvidence(section, evidence ?? result?.evidence);
  const n = sectionN(section);
  const caption = "caption" in section.data ? (section.data as { caption?: string }).caption : undefined;
  return (
    <Panel
      className={className}
      title={section.title}
      caption={caption}
      evidence={
        section.kind !== "text" && (n !== undefined || ev.length > 0) ? (
          <EvidenceKey n={n} date={result?.data_date} evidence={ev} note={result?.coverage_note} />
        ) : undefined
      }
    >
      <SectionBody section={section} />
    </Panel>
  );
}

const CONF = { high: 3, medium: 2, low: 1 } as const;
const CONF_TEXT = {
  high: "Plenty of people behind these numbers.",
  medium: "Enough people to see a pattern; treat exact figures loosely.",
  low: "Few people match, so read these as stories, not odds.",
} as const;

export interface ResultViewProps {
  result: ResultEnvelope;
  /** Only render these section ids. */
  only?: string[];
  /** Skip these section ids. */
  skip?: string[];
  hideHeader?: boolean;
  hideNextSteps?: boolean;
}

/** Renders any Result envelope: lead, every section, coverage footer and next steps. */
export function ResultView({ result, only, skip, hideHeader = false, hideNextSteps = false }: ResultViewProps) {
  const all = (result.sections ?? []).filter((s) => (!only || only.includes(s.id)) && !skip?.includes(s.id));
  const heroStat = all.find((s) => s.kind === "stat" && (s.data.count || s.data.value != null));
  const rest = all.filter((s) => s !== heroStat);
  const coverage = coverageOf(result);
  const n = result.cohort?.n_visible ?? (heroStat ? sectionN(heroStat) : undefined);

  return (
    <div className={styles.result}>
      {!hideHeader && (
        <div className={[styles.lead, !heroStat && styles.leadSolo].filter(Boolean).join(" ")}>
          {heroStat && heroStat.kind === "stat" && <Stat data={heroStat.data} variant="hero" cell={24} />}
          <Panel title={result.title} evidence={<EvidenceKey n={n} coverage={coverage} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />}>
            {result.summary && <p className={styles.summary}>{result.summary}</p>}
            {result.cohort && (
              <p className={styles.cohort}>
                <strong>Who counts: </strong>
                {result.cohort.definition}
                {result.cohort.widened && result.cohort.widened_reason && ` (widened: ${result.cohort.widened_reason})`}
              </p>
            )}
            <p className={styles.confidence}>
              <span className={styles.meter} aria-hidden="true">
                {[1, 2, 3].map((k) => (
                  <i key={k} className={k <= CONF[result.confidence] ? styles.on : undefined} />
                ))}
              </span>
              How sure: {result.confidence}. {CONF_TEXT[result.confidence]}
            </p>
            {result.warnings?.length > 0 && (
              <ul className={styles.warnings}>
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <div className={styles.sections}>
        {rest.map((s, i) => (
          <div key={s.id} className={[styles.assemble, isWide(s) && styles.wide].filter(Boolean).join(" ")} style={{ ["--i" as string]: i, ["--n" as string]: rest.length }}>
            <SectionView section={s} result={result} />
          </div>
        ))}
      </div>

      <footer className={styles.foot}>
        <p className={styles.coverage}>
          {result.coverage_note} Data as of {formatDate(result.data_date)}.
        </p>
        {!hideNextSteps && result.next_steps?.length > 0 && (
          <div className={styles.next}>
            {result.next_steps.map((s, i) => (
              <ButtonLink key={s.label} href={toolHref(s.tool, s.params)} variant={i === 0 ? "primary" : "secondary"} size={i === 0 ? "md" : "sm"}>
                {s.label}
              </ButtonLink>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}
