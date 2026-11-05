import type { ReactNode } from "react";
import type { ResultEnvelope } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { GridNumber } from "@/components/data/GridNumber";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./ToolHero.module.css";

const CONFIDENCE: Record<ResultEnvelope["confidence"], string> = {
  high: "Plenty of people behind this, so the picture is steady.",
  medium: "A fair number of people behind this. Read it as a good guide, not a promise.",
  low: "Only a few people behind this. Treat it as a hint, not a pattern.",
};

/** Cell size so a grid-built number of this many digits stays inside the hero's left column (17 cells of 32px). */
export function numeralCell(value: number): { cell: number; gap: number } {
  const digits = String(Math.round(Math.abs(value))).length;
  const cell = digits <= 3 ? 32 : digits === 4 ? 24 : 16;
  return { cell, gap: cell >= 32 ? 3 : 2 };
}

/** The headline count, built from grid cells at the size the hero has room for. */
export function HeroNumber({ value, label }: { value: number; label: string }) {
  const { cell, gap } = numeralCell(value);
  return <GridNumber value={value} cell={cell} gap={gap} label={label} />;
}

export interface ToolHeroProps {
  /** Small lead-in above the number, e.g. "At least". */
  lead?: string;
  /** The grid-built answer. */
  numeral: ReactNode;
  /** The one-sentence reading of the number (Chakra Petch, large). */
  say: ReactNode;
  /** Supporting reading text (Archivo). */
  note?: ReactNode;
  /** Primary button(s) under the sentence. */
  actions?: ReactNode;
  /** The cohort card, top right. */
  aside?: ReactNode;
}

/** Blend hero: monumental cell-built number left, sentence and button right, cohort card top right. */
export function ToolHero({ lead, numeral, say, note, actions, aside }: ToolHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.num}>
        {lead && <p className={styles.lead}>{lead}</p>}
        {numeral}
      </div>
      <div className={styles.right}>
        {aside}
        <div className={styles.sayBlock}>
          <p className={styles.say}>{say}</p>
          {note && <p className={styles.note}>{note}</p>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </div>
    </section>
  );
}

/** "Who we looked at": the white cohort card with the evidence key. */
export function CohortCard({ result, title = "Who we looked at", n, definition }: { result: ResultEnvelope; title?: string; n?: number; definition?: string }) {
  const c = result.cohort;
  return (
    <aside className={styles.cohort} aria-label={title}>
      <div className={styles.cohortHead}>
        <h2 className={styles.cohortTitle}>{title}</h2>
        <EvidenceKey n={n ?? c?.n_visible} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />
      </div>
      {(definition ?? c?.definition) && <p>{definition ?? c?.definition}.</p>}
      {c?.widened && c.widened_reason && <p className={styles.muted}>Widened: {c.widened_reason}</p>}
      <p className={styles.muted}>{CONFIDENCE[result.confidence]}</p>
    </aside>
  );
}

/** Warnings and thin-data notes in one white strip. */
export function Notes({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className={styles.notes} role="note">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

/** Section heading on the orange field: title plus one quiet line of context. */
export function SectionHead({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {meta && <p className={styles.sectionMeta}>{meta}</p>}
      {actions && <div className={styles.sectionActions}>{actions}</div>}
    </div>
  );
}

/** Next steps (first one primary with the slash) and the coverage line. */
export function ResultFoot({ result, primary = true }: { result: ResultEnvelope; primary?: boolean }) {
  return (
    <footer className={styles.foot}>
      {result.next_steps.length > 0 && (
        <div className={styles.steps}>
          {result.next_steps.map((step, i) => (
            <ButtonLink key={step.label} href={toolHref(step.tool, step.params)} variant={primary && i === 0 ? "primary" : "secondary"} slash={primary && i === 0}>
              {step.label}
            </ButtonLink>
          ))}
        </div>
      )}
      <p className={styles.coverage}>
        {result.coverage_note} Data from {formatDate(result.data_date)}.
      </p>
    </footer>
  );
}
