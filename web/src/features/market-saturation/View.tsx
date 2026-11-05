"use client";

import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { GridNumber } from "@/components/data/GridNumber";
import { RankedTable } from "@/components/data/RankedTable";
import { ResultView, SectionView } from "@/components/data/ResultView";
import { Timeseries } from "@/components/data/Timeseries";
import { ButtonLink } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { fmtInt, formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type { ResultEnvelope, Section, StatData } from "@/lib/types";
import { config, levelFor, type CompetitionLevel } from "./config";
import styles from "./View.module.css";

type Of<K extends Section["kind"]> = Extract<Section, { kind: K }>;

const LEVEL_WORD: Record<CompetitionLevel, string> = {
  low: "Low competition",
  medium: "Medium competition",
  high: "High competition",
};

/** Mentor-voice reading of the label, short enough to sit under the number. */
const LEVEL_SAY: Record<CompetitionLevel, string> = {
  low: "More openings than newcomers like you. There is room, so apply with confidence.",
  medium: "About as many newcomers as openings. Not easy and not shut: a clear story will help you stand out.",
  high: "More newcomers like you than openings. It is still possible, and it pays to be specific about what you offer.",
};

function ratioOf(stat: StatData): number | null {
  if (typeof stat.value === "number") return stat.value;
  const n = parseFloat(stat.display ?? "");
  return Number.isFinite(n) ? n : null;
}

/* ---------- the two cell stacks: one cell per person or posting ---------- */

function Stack({
  count,
  per,
  cols,
  tone,
  label,
}: {
  count: number;
  per: number;
  cols: number;
  tone: "entrants" | "openings";
  label: string;
}) {
  const cells = Math.max(count > 0 ? 1 : 0, Math.ceil(count / per));
  return (
    <span
      className={styles.stack}
      style={{ gridTemplateColumns: `repeat(${cols}, 10px)` }}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: cells }, (_, i) => (
        <i
          key={i}
          className={[tone === "entrants" ? styles.entrant : styles.opening, "ad-assemble"].join(" ")}
          style={{ ["--i" as string]: i, ["--n" as string]: cells }}
        />
      ))}
    </span>
  );
}

/** The ratio as grid numerals: 1.2 is two numerals around one square dot. */
function Ratio({ value }: { value: number }) {
  if (value >= 10) return <GridNumber value={value} cell={28} gap={4} label={`${Math.round(value)} entrants per opening`} />;
  const r = Math.round(value * 10) / 10;
  const whole = Math.floor(r);
  const tenth = Math.round((r - whole) * 10);
  return (
    <div className={styles.ratio} role="img" aria-label={`${r.toFixed(1)} entrants per opening`}>
      <GridNumber value={whole} cell={28} gap={4} label="" />
      <span className={styles.dot} aria-hidden="true" />
      <GridNumber value={tenth} cell={28} gap={4} label="" />
    </div>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className={styles.prose}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/* ---------- the screen ---------- */

export function View({ result }: { result: ResultEnvelope }) {
  const stats = result.sections.filter((s): s is Of<"stat"> => s.kind === "stat");
  const ratioSec = stats.find((s) => s.id === "ratio") ?? stats[0];
  if (!ratioSec || ratioOf(ratioSec.data) === null) return <ResultView result={result} />;

  const entrantsSec = stats.find((s) => s.id === "entrants");
  const openingsSec = stats.find((s) => s.id === "openings");
  const trend = result.sections.find((s): s is Of<"timeseries"> => s.kind === "timeseries");
  const read = result.sections.find((s): s is Of<"text"> => s.kind === "text");
  const cities = result.sections.find((s): s is Of<"ranked_table"> => s.kind === "ranked_table");
  const shown = new Set<Section>([ratioSec, entrantsSec, openingsSec, trend, read, cities].flatMap((s) => (s ? [s as Section] : [])));
  const others = result.sections.filter((s) => !shown.has(s));

  const ratio = ratioOf(ratioSec.data)!;
  const thinCount = (entrantsSec?.data.value ?? Infinity) < 10 || (openingsSec?.data.value ?? Infinity) < 10;
  const level: CompetitionLevel | null = thinCount ? null : ratioSec.data.level ?? levelFor(ratio);
  const city = typeof result.cohort?.filters?.city === "string" ? (result.cohort.filters.city as string) : null;

  const entrants = entrantsSec?.data.value ?? null;
  const openings = openingsSec?.data.value ?? null;
  const biggest = Math.max(entrants ?? 0, openings ?? 0, 1);
  const per = biggest > 600 ? Math.ceil(biggest / 600) : 1;
  const cols = biggest / per <= 200 ? 12 : biggest / per <= 400 ? 16 : 24;

  const exampleNote = result.warnings.find((w) => /^example data/i.test(w));
  const warnings = result.warnings.filter((w) => w !== exampleNote);
  const [first, ...more] = result.next_steps;
  const key = (n?: number) => (
    <EvidenceKey n={n} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />
  );

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.answer}>
          {exampleNote && <ExampleBadge force>{exampleNote}</ExampleBadge>}
          <p className={styles.least}>New people like you for every opening</p>
          <Ratio value={ratio} />
          <p className={styles.label}>{level ? LEVEL_WORD[level] : "Too early to say"}</p>
          <p className={styles.say}>
            {level ? LEVEL_SAY[level] : ratioSec.data.note ?? "There is not enough data yet to call this low, medium or high."}
          </p>
          {first && (
            <div className={styles.actions}>
              <ButtonLink href={toolHref(first.tool, first.params)}>{first.label}</ButtonLink>
              {more.map((s) => (
                <ButtonLink key={s.label} variant="secondary" slash={false} href={toolHref(s.tool, s.params)}>
                  {s.label}
                </ButtonLink>
              ))}
            </div>
          )}
        </div>

        <Panel
          title={ratioSec.title === "Entrants per opening" ? "Newcomers against openings" : ratioSec.title}
          headingLevel={2}
          evidence={key(result.cohort?.n_visible)}
          caption={ratioSec.data.note ?? undefined}
          className={styles.stacks}
        >
          {entrants !== null && openings !== null ? (
            <>
              <div className={styles.pair}>
                <figure className={styles.col}>
                  <figcaption>
                    <b className={styles.big}>{fmtInt(entrants)}</b>
                    <span>{entrantsSec!.data.label}</span>
                  </figcaption>
                  <Stack
                    count={entrants}
                    per={per}
                    cols={cols}
                    tone="entrants"
                    label={`${entrants} new entrants like you in the last ${config.entrantsWindowMonths} months`}
                  />
                </figure>
                <figure className={styles.col}>
                  <figcaption>
                    <b className={styles.big}>{fmtInt(openings)}</b>
                    <span>{openingsSec!.data.label}</span>
                  </figcaption>
                  <Stack
                    count={openings}
                    per={per}
                    cols={cols}
                    tone="openings"
                    label={`${openings} open postings a year, from the last ${config.openingsWindowDays} days`}
                  />
                </figure>
              </div>
              <div className={styles.legend} aria-hidden="true">
                <span>
                  <i className={styles.entrant} /> A new entrant like you, last {config.entrantsWindowMonths} months
                </span>
                <span>
                  <i className={styles.opening} /> An open posting, last {config.openingsWindowDays} days, times four
                </span>
                <span className={styles.each}>{per === 1 ? "One square each." : `One square is up to ${per}.`}</span>
              </div>
              {openingsSec!.data.note && <p className={styles.note}>{openingsSec!.data.note}.</p>}
            </>
          ) : (
            <p className={styles.note}>{ratioSec.data.label}</p>
          )}
          {result.cohort && (
            <p className={styles.note}>
              <b>Who is counted.</b> {result.cohort.definition}.
              {result.cohort.widened && result.cohort.widened_reason ? ` ${result.cohort.widened_reason}` : ""}
            </p>
          )}
        </Panel>
      </div>

      {result.summary && (
        <p className={styles.summary}>{result.summary}</p>
      )}

      {(trend || read) && (
        <div className={styles.mid}>
          {trend && (
            <Panel title={trend.title} headingLevel={2} evidence={key()} caption={trend.data.caption} className={styles.trend}>
              <Timeseries data={{ ...trend.data, caption: undefined }} height={260} />
            </Panel>
          )}
          {read && (
            <Panel title={read.title} headingLevel={2} className={styles.read}>
              <Paragraphs text={read.data.text} />
            </Panel>
          )}
        </div>
      )}

      {cities && (
        <Panel title={cities.title} headingLevel={2} evidence={key(cities.data.n)} caption={cities.data.caption}>
          <RankedTable data={{ ...cities.data, caption: undefined }} sortable />
        </Panel>
      )}

      {warnings.length > 0 && (
        <Panel title="Good to know" headingLevel={2}>
          <ul className={styles.list} role="list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Panel>
      )}

      {others.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <p className={styles.foot}>
        {result.coverage_note} Data as of {formatDate(result.data_date)}.
        {city ? ` Your target city: ${city}.` : ""}
      </p>
    </div>
  );
}
