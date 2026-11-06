"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  Cohort,
  DistributionData,
  DistributionItem,
  RankedTableData,
  ResultEnvelope,
  Section,
  SectionKind,
  StatData,
} from "@/lib/types";
import { toolHref } from "@/lib/tools";
import { fmtInt, formatDate } from "@/lib/format";
import { drillOf } from "@/components/tool/drill";
import { CohortCard, HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { Panel } from "@/components/data/Panel";
import { SectionView } from "@/components/data/ResultView";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { EmptyState } from "@/components/data/EmptyState";
import { PersonStrip } from "@/components/data/PersonStrip";
import { RankedTable } from "@/components/data/RankedTable";
import { Distribution } from "@/components/data/Distribution";
import { PlaceArt } from "@/components/art/PlaceArt";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useProfile } from "@/components/shell/ProfileContext";
import { BANDS_SHORT, lensCopy } from "./config";
import styles from "./View.module.css";

/** The engine reads a sample of the cohort for roles, employers and degrees and says so in `sample_n`. */
function sampleOf(data: object): number | undefined {
  const v = (data as { sample_n?: unknown }).sample_n;
  return typeof v === "number" && v > 0 ? v : undefined;
}

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

/** The place whose art stands for a destination item. */
function placeFor(label: string): string {
  if (/^still in india$/i.test(label)) return "India";
  if (/^(other|abroad)/i.test(label)) return "Other";
  return label;
}

/** A panel whose numbers come from the sample the engine read, not the whole cohort: it says so in the caption and the key. */
function SamplePanel({
  title,
  data,
  body,
  result,
}: {
  title: string;
  data: RankedTableData | DistributionData;
  body: ReactNode;
  result: ResultEnvelope;
}) {
  const sample = sampleOf(data);
  const cohortN = result.cohort?.n_visible;
  const empty = "rows" in data && data.rows.length === 0;
  const lead = sample ? `In a sample of ${fmtInt(sample)}${cohortN ? ` of the ${fmtInt(cohortN)}` : ""}.` : "";
  const note = (data as { note?: unknown }).note;
  const caption = [lead, empty ? "" : data.caption].filter(Boolean).join(" ");
  const label = sample ? `${data.n === undefined || data.n === sample ? `Sample of ${fmtInt(sample)}` : `N = ${fmtInt(data.n)} · sample of ${fmtInt(sample)}`} · ${formatDate(result.data_date)}` : undefined;
  return (
    <Panel
      title={title}
      caption={caption || undefined}
      evidence={<EvidenceKey n={data.n} label={label} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />}
    >
      {empty ? <EmptyState title="Too few people to list">{typeof note === "string" && note ? note : "Not enough of them share a single answer for us to name it. Open a country above to see the people instead."}</EmptyState> : body}
    </Panel>
  );
}

export function View({ result }: { result: ResultEnvelope }) {
  const router = useRouter();
  const { university } = useProfile();
  const lens = lensCopy(university);
  const who = lens.who;
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
  const items = useMemo(() => countries?.items ?? [], [countries]);
  const targetLabel = items.find((i) => i.target)?.label ?? items[0]?.label;
  const [focus, setFocus] = useState<string | undefined>(targetLabel);
  const focused = items.find((i) => i.label === focus) ?? items.find((i) => i.label === targetLabel);

  const thin = result.confidence === "low" || (cohort ? cohort.n_visible < 10 : n < 10);
  const band = bandOf(cohort);
  const cautions = result.warnings.filter((w) => !/^example data/i.test(w));
  const notes = [
    ...(thin
      ? [
          `Only ${fmtInt(cohort?.n_visible ?? n)} people match, so these numbers are a few stories, not odds. Nothing here says your path is unlikely. It says we cannot see enough yet.`,
        ]
      : []),
    ...cautions,
  ];

  const go = (match: string, b: string) => {
    router.push(toolHref("people_like_me", { match, exp_band: b ? b.split(",").map(Number) : undefined }));
  };

  const wider = useMemo(() => {
    if (!cohort) return null;
    const b = band;
    const nextMatch = NEXT_MATCH[cohort.match_level];
    const widerBand: [number, number] | undefined = b ? [Math.max(0, b[0] - (b[0] > 0 ? 1 : 0)), b[1] + 2] : undefined;
    return { match: nextMatch, band: nextMatch === cohort.match_level ? widerBand : (b ?? undefined) };
  }, [cohort, band]);

  /* hero: how many are abroad, in grid-built cells */
  const abroadThin = moved?.count ? moved.count.n < 10 : false;
  const heroValue = moved?.count ? (abroadThin ? moved.count.n : moved.count.k) : (size?.value ?? n);
  const movedLabel = moved ? moved.label.replace(/^of /, "").replace(/people like you/i, who) : "";
  const heroSay = moved?.count
    ? abroadThin
      ? `${moved.count.k} of ${moved.count.n} ${movedLabel}. That is too few to turn into a percentage.`
      : `of ${fmtInt(moved.count.n)} ${movedLabel}.`
    : `${who} we can see.`;
  const [firstStep, ...otherSteps] = result.next_steps;

  /* destinations: one poster tile per country group, the target focused */
  const topEmployers = (employers?.data.rows ?? []).filter((r) => !r.rest).slice(0, 3);
  const employerCol = employers?.data.columns.find((c) => c.type === "text")?.key ?? "employer";
  const peopleLabel = university ? "graduates" : "people";
  const tile = (it: DistributionItem) => {
    const on = it.label === focused?.label;
    const token = drillOf(it) ?? null;
    return (
      <PosterTile
        key={it.label}
        variant="poster"
        tone="band"
        title={it.label}
        art={<PlaceArt place={placeFor(it.label)} shape="portrait" />}
        count={it.count}
        unit={peopleLabel}
        expanded={on}
        badge={it.target && !university ? "Your target" : undefined}
        countLine={`${fmtInt(it.count)} of ${fmtInt(n)} ${who}`}
        details={
          on && it.target && topEmployers.length > 0 ? (
            <div className={styles.tileList}>
              <h4>Top employers</h4>
              <ul role="list">
                {topEmployers.map((r) => (
                  <li key={String(r.cells[employerCol])}>
                    <span>{String(r.cells[employerCol])}</span>
                    <b>{String(r.cells.people ?? "")}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : undefined
        }
        drill={on ? token : null}
        drillLabel={`See the ${fmtInt(it.count)} ${peopleLabel}`}
        onSelect={on ? undefined : () => setFocus(it.label)}
      />
    );
  };

  const degreeSplit = degrees && studied;

  return (
    <div className={styles.view}>
      <ToolHero
        lead={abroadThin ? "Out of" : "At least"}
        numeral={<HeroNumber value={heroValue} label={moved?.count?.display ?? `${heroValue}`} />}
        say={heroSay}
        note={result.summary}
        actions={
          firstStep && (
            <ButtonLink href={toolHref(firstStep.tool, firstStep.params)} variant="primary">
              {firstStep.label}
            </ButtonLink>
          )
        }
        aside={<CohortCard result={result} title={lens.cohortTitle} n={n || undefined} />}
      />

      {notes.length > 0 && (
        <div className={styles.notice}>
          <Notes lines={notes} />
          {thin && wider && (
            <ButtonLink variant="secondary" size="sm" href={toolHref("people_like_me", { match: wider.match, exp_band: wider.band })}>
              {university ? "Widen which graduates count" : "Widen who counts as like you"}
            </ButtonLink>
          )}
        </div>
      )}

      {cohort && (
        <section className={styles.adjust} aria-label={`Change ${lens.cohortTitle.toLowerCase()}`}>
          <div className={styles.group} role="group" aria-label={lens.matchLabel}>
            <p className={styles.groupLabel}>{lens.matchLabel}</p>
            <div className={styles.chips}>
              {lens.matches.map((m) => (
                <Chip key={m.value} selected={cohort.match_level === m.value} onClick={() => go(m.value, bandValue(band))}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className={styles.group} role="group" aria-label={lens.bandLabel}>
            <p className={styles.groupLabel}>{lens.bandLabel}</p>
            <div className={styles.chips}>
              {BANDS_SHORT.map((b) => (
                <Chip key={b.value} selected={bandValue(band) === b.value} onClick={() => go(cohort.match_level, b.value)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
        </section>
      )}

      {countries && (
        <PersonStrip
          items={items}
          n={countries.n}
          label={`${university ? "Your graduates" : "People like you"} by current country`}
          intro={`Each square is one ${university ? "graduate" : "person like you"}.`}
          keyLabel={`N = ${fmtInt(countries.n)} · by country`}
        />
      )}

      {items.length > 0 && (
        <TileRow
          band
          dim
          title={university ? "Where your graduates went" : "Where people like you went"}
          note={`${items.length} ${items.length === 1 ? "group" : "groups"} · every one of the ${fmtInt(n)} is counted once`}
          label="Destinations"
        >
          {items.map(tile)}
        </TileRow>
      )}

      {(roles || employers) && (
        <div className={styles.pair}>
          {roles && <SamplePanel title={roles.title} data={roles.data} body={<RankedTable data={{ ...roles.data, caption: undefined } as RankedTableData} />} result={result} />}
          {employers && (
            <SamplePanel title={employers.title} data={employers.data} body={<RankedTable data={{ ...employers.data, caption: undefined } as RankedTableData} />} result={result} />
          )}
        </div>
      )}

      {(degrees || studied) && (
        <div className={degreeSplit ? styles.pair : styles.single}>
          {degrees && (
            <SamplePanel
              title={degrees.title}
              data={degrees.data}
              result={result}
              body={
                <>
                  <Distribution data={{ ...degrees.data, caption: undefined } as DistributionData} />
                  {degrees.data.items.some((i) => i.remainder) && <p className={styles.note}>No further degree on a profile does not mean there is none.</p>}
                </>
              }
            />
          )}
          {studied && <SamplePanel title={studied.title} data={studied.data} body={<Distribution data={{ ...studied.data, caption: undefined } as DistributionData} />} result={result} />}
        </div>
      )}

      {rest.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: otherSteps }} />
    </div>
  );
}
