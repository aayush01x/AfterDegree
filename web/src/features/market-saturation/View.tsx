"use client";

import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { GridNumber } from "@/components/data/GridNumber";
import { RankedTable } from "@/components/data/RankedTable";
import { ResultView, SectionView } from "@/components/data/ResultView";
import { Timeseries } from "@/components/data/Timeseries";
import { useDrill } from "@/components/drill/useDrill";
import { ButtonLink } from "@/components/ui/Button";
import { CohortCard, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { drillOf } from "@/components/data/Drillable";
import type { DrillToken } from "@/lib/drill-types";
import { fmtInt } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type { ResultEnvelope, Section, StatData } from "@/lib/types";
import { config, levelFor, type CompetitionLevel } from "./config";
import { CityTiles } from "./CityTiles";
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
  drill,
}: {
  count: number;
  per: number;
  cols: number;
  tone: "entrants" | "openings";
  label: string;
  /** When the engine tags this count, the stack opens the people behind it. */
  drill?: { token: DrillToken; title: string } | null;
}) {
  const open = useDrill().open;
  const cells = Math.max(count > 0 ? 1 : 0, Math.ceil(count / per));
  const body = (
    <span className={styles.stack} style={{ gridTemplateColumns: `repeat(${cols}, 10px)` }} role={drill ? undefined : "img"} aria-label={drill ? undefined : label}>
      {Array.from({ length: cells }, (_, i) => (
        <i
          key={i}
          className={[tone === "entrants" ? styles.entrant : styles.opening, "ad-assemble"].join(" ")}
          style={{ ["--i" as string]: i, ["--n" as string]: cells }}
        />
      ))}
    </span>
  );
  return drill ? (
    <button type="button" className={styles.stackButton} onClick={() => open(drill.token, drill.title)} aria-label={`${label}. See who they are`}>
      {body}
    </button>
  ) : (
    body
  );
}

/** The ratio as grid numerals: 1.2 is two numerals around one square dot. */
function Ratio({ value }: { value: number }) {
  // Real data puts newcomers well below one per opening (0.03 is typical): show it per 100 openings so it never rounds to 0.0.
  if (value < 1) return <GridNumber value={Math.round(value * 100)} cell={32} gap={3} label={`${Math.round(value * 100)} entrants per 100 openings`} />;
  if (value >= 10) return <GridNumber value={value} cell={32} gap={3} label={`${Math.round(value)} entrants per opening`} />;
  const r = Math.round(value * 10) / 10;
  const whole = Math.floor(r);
  const tenth = Math.round((r - whole) * 10);
  return (
    <div className={styles.ratio} role="img" aria-label={`${r.toFixed(1)} entrants per opening`}>
      <GridNumber value={whole} cell={32} gap={3} label="" />
      <span className={styles.dot} aria-hidden="true" />
      <GridNumber value={tenth} cell={32} gap={3} label="" />
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

  const entrants = entrantsSec?.data.value ?? null;
  const openings = openingsSec?.data.value ?? null;
  const entrantsToken = drillOf(entrantsSec) ?? drillOf(entrantsSec?.data) ?? null;
  const biggest = Math.max(entrants ?? 0, openings ?? 0, 1);
  const per = biggest > 600 ? Math.ceil(biggest / 600) : 1;
  const cols = biggest / per <= 200 ? 12 : biggest / per <= 400 ? 16 : 24;

  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));
  const first = result.next_steps[0];
  const key = (n?: number) => <EvidenceKey n={n} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />;

  return (
    <div className={styles.root}>
      <ToolHero
        lead={ratio < 1 ? "New people like you for every 100 openings" : "New people like you for every opening"}
        numeral={<Ratio value={ratio} />}
        say={level ? LEVEL_WORD[level] : "Too early to say"}
        note={level ? LEVEL_SAY[level] : (ratioSec.data.note ?? "There is not enough data yet to call this low, medium or high.")}
        actions={first && <ButtonLink href={toolHref(first.tool, first.params)}>{first.label}</ButtonLink>}
        aside={<CohortCard result={result} />}
      />

      {result.summary && <p className={styles.summary}>{result.summary}</p>}
      <Notes lines={warnings} />

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
                  drill={entrantsToken ? { token: entrantsToken, title: entrantsSec!.data.label } : null}
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
                  drill={(() => {
                    const t = drillOf(openingsSec) ?? drillOf(openingsSec?.data);
                    return t ? { token: t, title: openingsSec!.data.label } : null;
                  })()}
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
      </Panel>

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

      {cities && <CityTiles section={cities} ratioLabel={ratio < 1 ? "per 100 openings" : "per opening"} />}

      {cities && (
        <Panel title={cities.title} headingLevel={2} evidence={key(cities.data.n)} caption={cities.data.caption}>
          <RankedTable data={{ ...cities.data, caption: undefined }} sortable />
        </Panel>
      )}

      {others.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: result.next_steps.slice(1) }} primary={false} />
    </div>
  );
}
