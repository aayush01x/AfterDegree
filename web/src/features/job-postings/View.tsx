"use client";

import { useEffect, useRef, useState } from "react";
import type { Evidence, ResultEnvelope, Section, StatData } from "@/lib/types";
import { fmtInt, formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { CountDisplay } from "@/components/data/CountDisplay";
import { GridNumber } from "@/components/data/GridNumber";
import { SectionView } from "@/components/data/ResultView";
import { ButtonLink } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import type { FeatureViewProps } from "../types";
import { CellSplit } from "./CellSplit";
import { StackedCells } from "./StackedCells";
import { EmployersTable } from "./EmployersTable";
import styles from "./View.module.css";

type StatSection = Extract<Section, { kind: "stat" }>;

function evidenceFor(result: ResultEnvelope, section: Section): Evidence[] {
  const ids = section.evidence_ids;
  return ids?.length ? result.evidence.filter((e) => ids.includes(e.id)) : result.evidence;
}

/** Pick a section by its id, falling back to a pattern on id, title or label. */
function pickStat(sections: Section[], id: string, pattern: RegExp): StatSection | undefined {
  const stats = sections.filter((s): s is StatSection => s.kind === "stat");
  return stats.find((s) => s.id === id) ?? stats.find((s) => pattern.test(`${s.id} ${s.title} ${s.data.label}`));
}

const statValue = (d?: StatData) => d?.value ?? d?.count?.k ?? null;

/** Size the grid-built numeral to the room it has. */
function useNumeralCell(digits: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(24);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      // a digit is 5 cells wide plus one cell of space between digits
      const raw = Math.floor(w / (digits * 6 - 1));
      setCell(Math.max(8, Math.min(32, raw)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [digits]);
  return { ref, cell };
}

function Headline({ result, now, prev, d30, evidence }: { result: ResultEnvelope; now: StatSection; prev?: StatSection; d30?: StatSection; evidence: Evidence[] }) {
  const value = statValue(now.data) ?? 0;
  const before = statValue(prev?.data);
  const { ref, cell } = useNumeralCell(String(Math.round(value)).length);

  let change: string | null = null;
  if (before !== null && before !== undefined) {
    if (value < 10 || before < 10) {
      change = `${fmtInt(before)} in the 90 days before. Too few postings to call a trend.`;
    } else {
      const pct = Math.round(((value - before) / before) * 100);
      change =
        pct === 0
          ? `About the same as the 90 days before (${fmtInt(before)}).`
          : `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on the 90 days before (${fmtInt(before)}).`;
    }
  }

  return (
    <Panel
      title={now.title || "Open postings"}
      evidence={<EvidenceKey n={value} date={result.data_date} evidence={evidence} note={result.coverage_note} />}
    >
      <div className={styles.headline}>
        <div ref={ref} className={styles.numeral}>
          <GridNumber value={value} cell={cell} gap={Math.max(2, Math.round(cell / 10))} label={`${fmtInt(value)} ${now.data.label}`} />
        </div>
        <p className={styles.say}>{now.data.label}</p>
        {change && <p className={styles.change}>{change}</p>}
        {d30 && statValue(d30.data) !== null && (
          <p className={styles.sub}>
            {fmtInt(statValue(d30.data)!)} {d30.data.label.replace(/^postings\s+/i, "")}
          </p>
        )}
      </div>
    </Panel>
  );
}

export function View({ result }: FeatureViewProps) {
  const isExample = result.warnings.some((w) => /example data/i.test(w));
  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));

  const sections = result.sections;
  const now = pickStat(sections, "open_90", /\b90\b/);
  const prev = pickStat(sections, "open_prev", /previous|before/i);
  const d30 = pickStat(sections, "open_30", /\b30\b/);
  const visa = pickStat(sections, "visa", /visa|sponsor/i);
  const trend = sections.find((s) => s.kind === "timeseries");
  const lang = sections.find((s) => s.kind === "distribution" && (s.id === "languages" || /language/i.test(s.title)));
  const employers = sections.find((s) => s.kind === "ranked_table" && (s.id === "employers" || /hire/i.test(JSON.stringify(s.data.columns))));
  const used = new Set<Section | undefined>([now, prev, d30, visa, trend, lang, employers]);

  const nPostings = statValue(now?.data) ?? undefined;
  const thin = nPostings !== undefined && nPostings < 10;
  const rest = sections.filter((s) => !used.has(s));
  const primary = rest.filter((s) => s.kind === "distribution" || s.kind === "keywords");
  const tail = rest.filter((s) => s.kind !== "distribution" && s.kind !== "keywords");

  const ev = (s?: Section) => (s ? evidenceFor(result, s) : result.evidence);

  return (
    <div className={styles.view}>
      <header className={styles.lead}>
        {result.summary && <p className={styles.summary}>{result.summary}</p>}
        {isExample && (
          <p className={styles.example}>
            <ExampleBadge force>Example data</ExampleBadge>
            <span>These numbers are made up to show the layout.</span>
          </p>
        )}
      </header>

      {(thin || warnings.length > 0) && (
        <div className={styles.notes} role="note">
          {thin && <p>Only {fmtInt(nPostings!)} postings turned up, so we show counts and skip shares and trends.</p>}
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {now && (
          <div className={styles.span5}>
            <Headline result={result} now={now} prev={prev} d30={d30} evidence={ev(now)} />
          </div>
        )}

        {trend && trend.kind === "timeseries" && (
          <Panel
            className={now ? styles.span7 : styles.span12}
            title={trend.title}
            caption={trend.data.caption}
            evidence={<EvidenceKey n={nPostings} date={result.data_date} evidence={ev(trend)} />}
          >
            <StackedCells data={trend.data} />
          </Panel>
        )}

        {lang && lang.kind === "distribution" && (
          <Panel
            className={styles.span7}
            title={lang.title}
            caption={lang.data.caption}
            evidence={<EvidenceKey n={lang.data.n} date={result.data_date} evidence={ev(lang)} />}
          >
            <CellSplit
              parts={lang.data.items.map((i) => ({ label: i.label, count: i.count }))}
              total={lang.data.n || lang.data.items.reduce((s, i) => s + i.count, 0)}
              unit={lang.data.unit ?? "postings"}
              label={`${lang.title}: ${lang.data.items.map((i) => `${i.label} ${i.count}`).join(", ")}`}
            />
          </Panel>
        )}

        {visa && visa.data.count && (
          <Panel
            className={lang ? styles.span5 : styles.span12}
            title={visa.title}
            evidence={<EvidenceKey n={visa.data.count.n} date={result.data_date} evidence={ev(visa)} />}
          >
            <div className={styles.visa}>
              <p className={styles.visaCount}>
                <CountDisplay count={visa.data.count} size="lg" showShare />
              </p>
              <p className={styles.say}>{visa.data.label}</p>
              <CellSplit
                parts={[
                  { label: "Mention it", count: visa.data.count.k },
                  { label: "Do not mention it", count: Math.max(0, visa.data.count.n - visa.data.count.k) },
                ]}
                total={visa.data.count.n}
                label={`${visa.data.count.display} postings mention visa sponsorship`}
              />
              <p className={styles.fine}>A posting that stays silent may still sponsor. Ask the employer before you apply.</p>
            </div>
          </Panel>
        )}

        {primary.map((s) => (
          <div key={s.id} className={s.kind === "keywords" ? styles.span7 : styles.span5}>
            <SectionView section={s} evidence={ev(s)} result={result} />
          </div>
        ))}

        {employers && employers.kind === "ranked_table" && (
          <Panel
            className={styles.span12}
            title={employers.title}
            caption={employers.data.caption}
            evidence={<EvidenceKey n={employers.data.n} date={result.data_date} evidence={ev(employers)} />}
          >
            <EmployersTable data={employers.data} />
          </Panel>
        )}

        {tail.map((s) => (
          <div key={s.id} className={styles.span12}>
            <SectionView section={s} evidence={ev(s)} result={result} />
          </div>
        ))}
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
