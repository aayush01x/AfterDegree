"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Cohort,
  DistributionData,
  RankedTableData,
  ResultEnvelope,
  Section,
  SectionKind,
  StatData,
} from "@/lib/types";
import { toolHref } from "@/lib/tools";
import { formatDate, fmtInt } from "@/lib/format";
import { Panel } from "@/components/data/Panel";
import { SectionView, coverageOf } from "@/components/data/ResultView";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { CohortWaffle } from "@/components/data/CohortWaffle";
import { GridNumber } from "@/components/data/GridNumber";
import { RankedTable } from "@/components/data/RankedTable";
import { Distribution } from "@/components/data/Distribution";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Tabs } from "@/components/ui/Tabs";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { BANDS, MATCH_LEVELS } from "./config";
import styles from "./View.module.css";

const CONF = {
  high: "Plenty of people match, so the pattern is reliable.",
  medium: "Enough people to see a pattern; treat exact figures loosely.",
  low: "Few people match, so read these as stories, not odds.",
} as const;

type Of<K extends SectionKind> = Extract<Section, { kind: K }>;

function find<K extends SectionKind>(sections: Section[], id: string, kind: K): Of<K> | undefined {
  return sections.find((s): s is Of<K> => s.id === id && s.kind === kind);
}

/** Sections this view lays out itself; anything else falls back to the shared renderer. */
const HANDLED = new Set([
  "cohort_size",
  "countries",
  "roles",
  "employers_target",
  "further_degrees",
  "degree_countries",
  "moved_abroad",
]);

const NEXT_MATCH = { exact_school: "school_tier", school_tier: "field_only", field_only: "field_only" } as const;

function bandOf(cohort: Cohort | null): [number, number] | null {
  const b = cohort?.filters?.exp_band;
  return Array.isArray(b) && b.length === 2 && b.every((x) => typeof x === "number") ? (b as [number, number]) : null;
}

function bandValue(b: [number, number] | null) {
  return b ? `${b[0]},${b[1]}` : "";
}

function shareText(count: number, n: number) {
  return n < 10 ? `${count} of ${n} (too few to compare)` : `at least ${fmtInt(count)} of ${fmtInt(n)}`;
}

export function View({ result }: { result: ResultEnvelope }) {
  const router = useRouter();
  const { sections, cohort } = result;

  const countries = find(sections, "countries", "distribution")?.data as DistributionData | undefined;
  const roles = find(sections, "roles", "ranked_table");
  const employers = find(sections, "employers_target", "ranked_table");
  const degrees = find(sections, "further_degrees", "distribution");
  const studied = find(sections, "degree_countries", "distribution");
  const moved = find(sections, "moved_abroad", "stat")?.data as StatData | undefined;
  const size = find(sections, "cohort_size", "stat")?.data as StatData | undefined;
  const rest = sections.filter((s) => !HANDLED.has(s.id));

  const n = countries?.n ?? cohort?.n_visible ?? size?.value ?? 0;
  const targetLabel = countries?.items.find((i) => i.target)?.label;
  const [selected, setSelected] = useState<string | undefined>(targetLabel);
  const picked = countries?.items.find((i) => i.label === selected);

  const thin = result.confidence === "low" || (cohort ? cohort.n_visible < 10 : n < 10);
  const band = bandOf(cohort);
  const examples = result.warnings.filter((w) => /^example data/i.test(w));
  const cautions = result.warnings.filter((w) => !/^example data/i.test(w));

  const go = (match: string, b: string) => {
    const [lo, hi] = (b || "1,3").split(",").map(Number);
    router.push(toolHref("people_like_me", { match, exp_band: [lo, hi] }));
  };

  const wider = useMemo(() => {
    if (!cohort) return null;
    const b = band ?? [1, 3];
    const nextMatch = NEXT_MATCH[cohort.match_level];
    const widerBand: [number, number] = [Math.max(0, b[0] - (b[0] > 0 ? 1 : 0)), b[1] + 2];
    return { match: nextMatch, band: nextMatch === cohort.match_level ? widerBand : b };
  }, [cohort, band]);

  const evidence = (
    <EvidenceKey n={n || undefined} coverage={coverageOf(result)} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />
  );

  const degreeNumbers = (degrees?.data.items ?? []).filter((i) => !i.remainder);
  const degreeRest = (degrees?.data.items ?? []).find((i) => i.remainder);

  const tabs = [
    roles && {
      id: "roles",
      label: roles.title,
      content: <RankedTable data={roles.data as RankedTableData} />,
    },
    employers && {
      id: "employers",
      label: employers.title,
      content: <RankedTable data={employers.data as RankedTableData} />,
    },
    degrees && {
      id: "degrees",
      label: degrees.title,
      content: (
        <div className={styles.degrees}>
          <ul className={styles.degreeRow} role="list">
            {degreeNumbers.map((d) => (
              <li key={d.label} className={styles.degree}>
                <GridNumber value={d.count} cell={9} gap={2} label={`${d.count} ${d.label}`} />
                <span>{d.label}</span>
              </li>
            ))}
          </ul>
          {degrees.data.caption && <p className={styles.note}>{degrees.data.caption}</p>}
          {degreeRest && (
            <p className={styles.note}>
              {fmtInt(degreeRest.count)} of {fmtInt(degrees.data.n)} show no further degree on their profile, which does not mean they have none.
            </p>
          )}
          {studied && (
            <div className={styles.studied}>
              <h4 className={styles.subhead}>{studied.title}</h4>
              <Distribution data={studied.data as DistributionData} />
            </div>
          )}
        </div>
      ),
    },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[];

  return (
    <div className={styles.view}>
      <div className={styles.top}>
        {result.summary && (
          <Panel title="What this tells you" evidence={evidence} className={styles.summary}>
            <p className={styles.say}>{result.summary}</p>
            <p className={styles.sure}>How sure: {result.confidence}. {CONF[result.confidence]}</p>
            {examples.length > 0 && (
              <p className={styles.badgeRow}>
                <ExampleBadge />
              </p>
            )}
          </Panel>
        )}

        {cohort && (
          <Panel title="Who counts as like you" className={styles.cohort}>
            <p className={styles.def}>{cohort.definition}</p>
            <div className={styles.chipGroup} role="group" aria-label="How closely people match you">
              {MATCH_LEVELS.map((m) => (
                <Chip
                  key={m.value}
                  selected={cohort.match_level === m.value}
                  onClick={() => go(m.value, bandValue(band) || "1,3")}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
            <div className={styles.chipGroup} role="group" aria-label="Years of work experience">
              {BANDS.map((b) => (
                <Chip
                  key={b.value}
                  selected={bandValue(band) === b.value}
                  onClick={() => go(cohort.match_level, b.value)}
                >
                  {b.label}
                </Chip>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {(thin || cohort?.widened || cautions.length > 0) && (
        <Panel title={thin ? "This is a small group" : "Worth knowing"} className={styles.notice}>
          {cohort?.widened && cohort.widened_reason && <p>{cohort.widened_reason}</p>}
          {thin && (
            <p>
              Only {fmtInt(cohort?.n_visible ?? n)} people match, so these numbers are a few stories, not odds. Nothing here says
              your path is unlikely. It says we cannot see enough people yet.
            </p>
          )}
          {cautions.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {thin && wider && (
            <p className={styles.actions}>
              <ButtonLink variant="secondary" size="sm" href={toolHref("people_like_me", { match: wider.match, exp_band: wider.band })}>
                Widen who counts as like you
              </ButtonLink>
            </p>
          )}
        </Panel>
      )}

      {countries && (
        <div className={styles.hero}>
          {moved?.count && (
            <div className={styles.movedBlock}>
              <p className={styles.least}>{moved.count.n < 10 ? "Out of" : "At least"}</p>
              <GridNumber
                value={moved.count.n < 10 ? moved.count.n : moved.count.k}
                cell={moved.count.k >= 100 ? 24 : 32}
                gap={3}
                label={moved.count.display}
              />
              <p className={styles.movedSay}>
                {moved.count.n < 10
                  ? `${moved.count.k} of ${moved.count.n} ${moved.label.replace(/^of /, "")}. That is too few to turn into a percentage.`
                  : `of ${fmtInt(moved.count.n)} ${moved.label.replace(/^of /, "")}.`}
              </p>
            </div>
          )}
          <Panel
            title={countries.n ? `Where the ${fmtInt(countries.n)} are now` : "Where they are now"}
            caption={countries.caption}
            evidence={evidence}
            className={styles.waffle}
          >
            <CohortWaffle
              items={countries.items}
              n={countries.n}
              unit={countries.unit}
              selected={selected}
              onSelect={setSelected}
              label="People like you by current country"
            />
            <p className={styles.readout} aria-live="polite">
              {picked
                ? `${picked.label}: ${shareText(picked.count, countries.n)} people like you.`
                : "Choose a country to see how many people are there."}
            </p>
          </Panel>
        </div>
      )}

      {tabs.length > 0 && (
        <Panel title="In more detail" evidence={evidence}>
          <Tabs label="Details about people like you" tabs={tabs} />
        </Panel>
      )}

      {rest.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      {result.next_steps.length > 0 && (
        <div className={styles.next}>
          {result.next_steps.map((s, i) => (
            <ButtonLink
              key={s.label}
              href={toolHref(s.tool, s.params)}
              variant={i === 0 ? "primary" : "secondary"}
              size={i === 0 ? "md" : "sm"}
            >
              {s.label}
            </ButtonLink>
          ))}
        </div>
      )}

      <p className={styles.foot}>
        {result.coverage_note} Data as of {formatDate(result.data_date)}.
      </p>
    </div>
  );
}
