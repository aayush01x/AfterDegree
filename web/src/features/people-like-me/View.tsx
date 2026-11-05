"use client";

import { useMemo, useState } from "react";
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
import { fmtInt } from "@/lib/format";
import { drillOf } from "@/components/tool/drill";
import { HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { Panel } from "@/components/data/Panel";
import { SectionView, coverageOf } from "@/components/data/ResultView";
import { EvidenceKey } from "@/components/data/EvidenceKey";
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

/** The place whose art stands for a destination item. */
function placeFor(label: string): string {
  if (/^still in india$/i.test(label)) return "India";
  if (/^(other|abroad)/i.test(label)) return "Other";
  return label;
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
    ...(cohort?.widened && cohort.widened_reason ? [cohort.widened_reason] : []),
    ...(thin
      ? [
          `Only ${fmtInt(cohort?.n_visible ?? n)} people match, so these numbers are a few stories, not odds. Nothing here says your path is unlikely. It says we cannot see enough yet.`,
        ]
      : []),
    ...cautions,
  ];

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

  /* hero: how many are abroad, in grid-built cells */
  const abroadThin = moved?.count ? moved.count.n < 10 : false;
  const heroValue = moved?.count ? (abroadThin ? moved.count.n : moved.count.k) : (size?.value ?? n);
  const heroSay = moved?.count
    ? abroadThin
      ? `${moved.count.k} of ${moved.count.n} ${moved.label.replace(/^of /, "")}. That is too few to turn into a percentage.`
      : `of ${fmtInt(moved.count.n)} ${moved.label.replace(/^of /, "")}.`
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
        countLine={`at least ${fmtInt(it.count)} of ${fmtInt(n)} ${who}`}
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
          <>
            {firstStep && (
              <ButtonLink href={toolHref(firstStep.tool, firstStep.params)} variant="primary">
                {firstStep.label}
              </ButtonLink>
            )}
          </>
        }
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
        <section className={styles.cohort} aria-label={lens.cohortTitle}>
          <div className={styles.cohortText}>
            <div className={styles.cohortHead}>
              <h2>{lens.cohortTitle}</h2>
              {evidence}
            </div>
            <p>{cohort.definition}.</p>
            <p className={styles.muted}>{CONF[result.confidence]}</p>
          </div>
          <div className={styles.adjust}>
            <div className={styles.group} role="group" aria-label={lens.matchLabel}>
              <p className={styles.groupLabel}>{lens.matchLabel}</p>
              <div className={styles.chips}>
                {lens.matches.map((m) => (
                  <Chip key={m.value} selected={cohort.match_level === m.value} onClick={() => go(m.value, bandValue(band) || "1,3")}>
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
          note={`${items.length} ${items.length === 1 ? "group" : "destinations"} · every count is “at least”, of ${fmtInt(n)}`}
          label="Destinations"
        >
          {items.map(tile)}
        </TileRow>
      )}

      {(roles || employers) && (
        <div className={styles.pair}>
          {roles && (
            <Panel title={roles.title} caption={roles.data.caption} evidence={evidence}>
              <RankedTable data={roles.data as RankedTableData} />
            </Panel>
          )}
          {employers && (
            <Panel title={employers.title} caption={employers.data.caption} evidence={evidence}>
              <RankedTable data={employers.data as RankedTableData} />
            </Panel>
          )}
        </div>
      )}

      {(degrees || studied) && (
        <div className={degreeSplit ? styles.pair : styles.single}>
          {degrees && (
            <Panel title={degrees.title} caption={degrees.data.caption} evidence={evidence}>
              <Distribution data={degrees.data as DistributionData} />
              {degrees.data.items.some((i) => i.remainder) && (
                <p className={styles.note}>
                  No further degree on a profile does not mean there is none.
                </p>
              )}
            </Panel>
          )}
          {studied && (
            <Panel title={studied.title} caption={studied.data.caption} evidence={evidence}>
              <Distribution data={studied.data as DistributionData} />
            </Panel>
          )}
        </div>
      )}

      {rest.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: otherSteps }} />
    </div>
  );
}
