"use client";

import type { Evidence, ResultEnvelope, Section } from "@/lib/types";
import { fmtInt, formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { SectionView } from "@/components/data/ResultView";
import { ButtonLink } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import type { FeatureViewProps } from "../types";
import { FlowGraph } from "./FlowGraph";
import { CellColumns } from "./CellColumns";
import styles from "./View.module.css";

const CONFIDENCE: Record<ResultEnvelope["confidence"], string> = {
  high: "Plenty of people behind this, so the picture is steady.",
  medium: "A fair number of people behind this. Read it as a good guide, not a promise.",
  low: "Only a few people behind this. Treat it as a hint, not a pattern.",
};

function evidenceFor(result: ResultEnvelope, section: Section): Evidence[] {
  const ids = section.evidence_ids;
  return ids?.length ? result.evidence.filter((e) => ids.includes(e.id)) : result.evidence;
}

function isYears(s: Section) {
  return s.kind === "distribution" && (s.id === "years" || /year|experience/i.test(s.title));
}

export function View({ result }: FeatureViewProps) {
  const isExample = result.warnings.some((w) => /example data/i.test(w));
  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));
  const n = result.cohort?.n_visible;
  const thin = n !== undefined && n < 10;

  const graph = result.sections.find((s) => s.kind === "routes");
  const rest = result.sections.filter((s) => s !== graph);
  const tables = rest.filter((s) => s.kind === "ranked_table");
  const tableSpan = tables.length >= 3 ? styles.span4 : tables.length === 2 ? styles.span6 : styles.span12;

  return (
    <div className={styles.view}>
      <header className={styles.head}>
        <div className={styles.lead}>
          {result.summary && <p className={styles.summary}>{result.summary}</p>}
          {isExample && (
            <p className={styles.example}>
              <ExampleBadge force>Example data</ExampleBadge>
              <span>These numbers are made up to show the layout.</span>
            </p>
          )}
        </div>
        {result.cohort && (
          <aside className={styles.cohort} aria-label="Who we looked at">
            <h2 className={styles.cohortTitle}>Who we looked at</h2>
            <p>{result.cohort.definition}</p>
            {result.cohort.widened && result.cohort.widened_reason && <p className={styles.widened}>Widened: {result.cohort.widened_reason}</p>}
            <p className={styles.confidence}>{CONFIDENCE[result.confidence]}</p>
            <EvidenceKey n={result.cohort.n_visible} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />
          </aside>
        )}
      </header>

      {(thin || warnings.length > 0) && (
        <div className={styles.notes} role="note">
          {thin && (
            <p>
              Only {fmtInt(n!)} {n === 1 ? "person" : "people"} match, so we show counts without calling any route typical.
            </p>
          )}
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {graph && graph.kind === "routes" && (
          <Panel
            className={styles.span12}
            title={graph.title}
            caption={graph.data.caption}
            evidence={<EvidenceKey n={n ?? undefined} date={result.data_date} evidence={evidenceFor(result, graph)} note={result.coverage_note} />}
          >
            <FlowGraph data={graph.data} label={`${graph.title}: lines from employers to titles to the position`} />
          </Panel>
        )}

        {rest.map((s) => {
          if (s.kind === "distribution" && isYears(s)) {
            const top = [...s.data.items].sort((a, b) => b.count - a.count)[0];
            return (
              <Panel
                key={s.id}
                className={styles.span12}
                title={s.title}
                caption={s.data.caption}
                evidence={<EvidenceKey n={s.data.n} date={result.data_date} evidence={evidenceFor(result, s)} />}
              >
                <CellColumns data={s.data} />
                {top && s.data.n >= 10 && (
                  <p className={styles.reading}>
                    Most common: {top.label.toLowerCase()}, {fmtInt(top.count)} of {fmtInt(s.data.n)} people.
                  </p>
                )}
              </Panel>
            );
          }
          return (
            <div key={s.id} className={s.kind === "ranked_table" ? tableSpan : styles.span12}>
              <SectionView section={s} evidence={evidenceFor(result, s)} result={result} />
            </div>
          );
        })}
      </div>

      <footer className={styles.foot}>
        {result.next_steps.length > 0 && (
          <div className={styles.steps}>
            {result.next_steps.map((step, i) => (
              <ButtonLink key={step.label} href={toolHref(step.tool, step.params)} variant="primary" slash={i === 0}>
                {step.label}
              </ButtonLink>
            ))}
          </div>
        )}
        <p className={styles.coverage}>
          {result.coverage_note} Data from {formatDate(result.data_date)}.
        </p>
      </footer>
    </div>
  );
}
