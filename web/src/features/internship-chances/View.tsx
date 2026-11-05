"use client";

import { useMemo, useState } from "react";
import type { DrillToken } from "@/lib/drill-types";
import type { Count, RankedRow, RankedTableData, ResultEnvelope, Section, SectionKind, StatData } from "@/lib/types";
import { toolHref } from "@/lib/tools";
import { fmtInt, fmtPct } from "@/lib/format";
import { isCount } from "@/lib/count";
import { drillOf, pressable } from "@/components/tool/drill";
import { HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { useDrill } from "@/components/drill/useDrill";
import { Panel } from "@/components/data/Panel";
import { SectionView, coverageOf } from "@/components/data/ResultView";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { RankedTable } from "@/components/data/RankedTable";
import { CompanyMark } from "@/components/art/CompanyMark";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import { ButtonLink } from "@/components/ui/Button";
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

const HANDLED = new Set(["chance", "companies", "method"]);

interface Group {
  key: string;
  company: string;
  seen: number;
  converted: number;
  target: boolean;
  rest: boolean;
  drill: DrillToken | null;
}

/** Turn the ranked table into cell groups, one cell per intern, converted cells first. */
function groupsFrom(table: RankedTableData | undefined): Group[] {
  if (!table) return [];
  const out: Group[] = [];
  for (const row of table.rows as RankedRow[]) {
    const c = row.count ?? (isCount(row.cells.chance) ? (row.cells.chance as Count) : undefined);
    if (!c) continue;
    const name = String(row.cells.company ?? row.id ?? "Company");
    out.push({
      key: row.id ?? name,
      company: name,
      seen: c.n,
      converted: c.k,
      target: !!row.you,
      rest: !!row.rest,
      drill: row.rest ? null : (drillOf(row) ?? null),
    });
  }
  // keep the folded "Other" row last
  return [...out.filter((g) => !g.rest), ...out.filter((g) => g.rest)];
}

export function View({ result }: { result: ResultEnvelope }) {
  const { sections, cohort } = result;
  const chanceSection = find(sections, "chance", "stat");
  const chance = (chanceSection?.data as StatData | undefined)?.count ?? null;
  const chanceLabel = (chanceSection?.data as StatData | undefined)?.label ?? "later went full-time at the same company";
  const companies = find(sections, "companies", "ranked_table");
  const method = find(sections, "method", "text");
  const rest = sections.filter((s) => !HANDLED.has(s.id));

  const groups = useMemo(() => groupsFrom(companies?.data), [companies]);
  const named = groups.filter((g) => !g.rest);
  const grouped = groups.reduce((s, g) => s + g.seen, 0);
  const useGroups = chance !== null && grouped === chance.n && groups.length > 0;
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const gridFocus = picked ?? named.find((g) => g.target)?.key;
  const focusKey = gridFocus ?? named[0]?.key;

  const thin = result.confidence === "low" || (chance ? chance.n < 10 : false);
  const cautions = result.warnings.filter((w) => !/^example data/i.test(w));
  const evidence = <EvidenceKey n={chance?.n} coverage={coverageOf(result)} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />;

  const country = typeof cohort?.filters?.country === "string" ? cohort.filters.country : undefined;
  const role = typeof cohort?.filters?.role === "string" ? cohort.filters.role : undefined;
  const widenHref = country && role ? toolHref("internship_chances", { country }) : null;

  const percent = chance && chance.share !== null ? Math.round(chance.share * 100) : null;
  const lo = chance?.ci ? fmtPct(chance.ci[0]) : null;
  const hi = chance?.ci ? fmtPct(chance.ci[1]) : null;
  const notes = [
    ...(cohort?.widened && cohort.widened_reason ? [cohort.widened_reason] : []),
    ...(thin
      ? [
          `We found only ${chance ? fmtInt(chance.n) : "a few"} people like you here. With so few, one more or one less would change the answer, so we show the counts and no percentage. This says nothing bad about your chances. It says we cannot see enough yet.`,
        ]
      : []),
    ...cautions,
  ];
  const [firstStep, ...otherSteps] = result.next_steps;
  const tail = chanceLabel.replace(/^interns and working students /, "");

  return (
    <div className={styles.view}>
      {chance && (
        <ToolHero
          lead={thin ? "Out of" : "About"}
          numeral={
            percent !== null ? (
              <div className={styles.numeral}>
                <HeroNumber value={percent} label={`${percent} percent`} />
                <span className={styles.pct} aria-hidden="true">
                  %
                </span>
              </div>
            ) : (
              <HeroNumber value={chance.n} label={`${chance.n} people`} />
            )
          }
          say={
            percent !== null
              ? `of interns and working students like you ${tail}.`
              : `${chance.k} of them ${tail}. That is too few to call a chance.`
          }
          note={
            <>
              {result.summary}
              {lo && hi ? ` The range runs from ${lo} to ${hi}, and narrows as more people appear.` : ""}
            </>
          }
          actions={
            firstStep && (
              <ButtonLink href={toolHref(firstStep.tool, firstStep.params)} variant="primary">
                {firstStep.label}
              </ButtonLink>
            )
          }
        />
      )}

      {(chance || notes.length > 0) && (
        <div className={styles.context}>
          {chance && (
            <aside className={styles.cohort} aria-label="Who we looked at">
              <div className={styles.cohortHead}>
                <h2>Who we looked at</h2>
                {evidence}
              </div>
              {cohort && <p>{cohort.definition}.</p>}
              <p className={styles.muted}>
                {fmtInt(chance.k)} of {fmtInt(chance.n)} went full-time at the same company. How sure: {result.confidence}. {CONF[result.confidence]}
              </p>
            </aside>
          )}
          {notes.length > 0 && (
            <div className={styles.notice}>
              <Notes lines={notes} />
              {thin && widenHref && (
                <ButtonLink variant="secondary" size="sm" href={widenHref}>
                  Look at any role in {country}
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      )}

      {named.length > 0 && (
        <TileRow
          title="Companies that took interns"
          note={`${named.length} ${named.length === 1 ? "company" : "companies"} · went full-time, of the interns we saw`}
          label="Companies"
        >
          {named.map((g) => {
            const on = g.key === focusKey;
            const pct = g.seen >= 10 ? Math.round((g.converted / g.seen) * 100) : null;
            return (
              <PosterTile
                key={g.key}
                variant="card"
                title={g.company}
                art={<CompanyMark name={g.company} shape="landscape" />}
                count={g.converted}
                unit={`of ${g.seen}`}
                expanded={on}
                badge={g.target ? "On your list" : undefined}
                countLine={`at least ${g.converted} of ${g.seen} went full-time`}
                details={
                  on ? (
                    <p className={styles.tileSay}>
                      {pct !== null ? `About ${pct}% of the interns we saw here went full-time.` : "Too few interns here to call a percentage."}
                    </p>
                  ) : undefined
                }
                drill={on ? g.drill : null}
                drillLabel={`See the ${g.seen} at ${g.company}`}
                onSelect={on ? undefined : () => setPicked(g.key)}
              />
            );
          })}
        </TileRow>
      )}

      {chance && (
        <Panel
          title={`The ${fmtInt(chance.n)} people like you`}
          caption="Each square is one intern or working student like you. Filled squares went full-time at the same company. Choose a company to see who they were."
          evidence={evidence}
        >
          <CellGrid chance={chance} groups={useGroups ? groups : []} focus={gridFocus} onPick={setPicked} />
          <ul className={styles.legend} role="list">
            <li>
              <i className={styles.keyFull} aria-hidden="true" /> Went full-time at the same company · {chance.k}
            </li>
            <li>
              <i className={styles.keyHollow} aria-hidden="true" /> Did not, as far as we can see · {chance.n - chance.k}
            </li>
          </ul>
        </Panel>
      )}

      {companies && (
        <Panel title={companies.title} caption={companies.data.caption} evidence={evidence}>
          <RankedTable data={companies.data as RankedTableData} />
        </Panel>
      )}
      {method && <SectionView section={method} evidence={result.evidence} result={result} />}

      {rest.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: otherSteps }} />
    </div>
  );
}

function Cells({ g, start, total, on }: { g: { seen: number; converted: number }; start: number; total: number; on?: boolean }) {
  return (
    <span className={styles.cells}>
      {Array.from({ length: g.seen }, (_, i) => (
        <i
          key={i}
          className={[styles.cell, i < g.converted ? styles.full : styles.hollow, on && styles.pick, "ad-assemble"].filter(Boolean).join(" ")}
          style={{ ["--i" as string]: start + i, ["--n" as string]: total }}
        />
      ))}
    </span>
  );
}

function CellGrid({
  chance,
  groups,
  focus,
  onPick,
}: {
  chance: Count;
  groups: Group[];
  focus?: string;
  onPick: (key: string) => void;
}) {
  const drill = useDrill();
  const total = chance.n;
  if (groups.length === 0) {
    // No company breakdown that adds up: one run of cells, converted first.
    return (
      <div className={styles.groups}>
        <div className={styles.solo} role="img" aria-label={`${chance.k} of ${chance.n} people like you went full-time at the same company`}>
          <Cells g={{ seen: total, converted: chance.k }} start={0} total={total} />
        </div>
      </div>
    );
  }
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((sum, x) => sum + x.seen, 0));
  return (
    <ul className={styles.groups} role="list">
      {groups.map((g, gi) => {
        const on = focus === g.key;
        const label = `${g.company}: ${g.converted} of ${g.seen} went full-time`;
        const open = () => {
          onPick(g.key);
          if (g.drill) drill.open(g.drill, g.company);
        };
        const body = (
          <>
            <span className={styles.groupName}>{g.company}</span>
            <Cells g={g} start={starts[gi]} total={total} on={on} />
            <span className={styles.groupCount}>
              {g.converted} of {g.seen}
            </span>
          </>
        );
        return (
          <li key={g.key}>
            {g.rest ? (
              <div className={styles.group} role="img" aria-label={label}>
                {body}
              </div>
            ) : (
              <div
                className={[styles.group, styles.hit, on && styles.on].filter(Boolean).join(" ")}
                aria-label={g.drill ? `${label}. Open the people at ${g.company}` : label}
                aria-pressed={g.drill ? undefined : on}
                {...pressable(open)}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
