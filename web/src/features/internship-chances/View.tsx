"use client";

import { useMemo, useState } from "react";
import type {
  Count,
  RankedRow,
  RankedTableData,
  ResultEnvelope,
  Section,
  SectionKind,
  StatData,
} from "@/lib/types";
import { toolHref } from "@/lib/tools";
import { formatDate, fmtInt, fmtPct } from "@/lib/format";
import { isCount } from "@/lib/count";
import { Panel } from "@/components/data/Panel";
import { SectionView, coverageOf } from "@/components/data/ResultView";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { CountDisplay } from "@/components/data/CountDisplay";
import { GridNumber } from "@/components/data/GridNumber";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
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
}

/** Turn the ranked table into cell groups, one cell per intern, converted cells first. */
function groupsFrom(table: RankedTableData | undefined): Group[] {
  if (!table) return [];
  const out: Group[] = [];
  for (const row of table.rows as RankedRow[]) {
    const c = row.count ?? (isCount(row.cells.chance) ? (row.cells.chance as Count) : undefined);
    if (!c) continue;
    const name = String(row.cells.company ?? row.id ?? "Company");
    out.push({ key: row.id ?? name, company: name, seen: c.n, converted: c.k, target: !!row.you });
  }
  // keep the folded "Other" row last
  const restKeys = new Set((table.rows as RankedRow[]).filter((r) => r.rest).map((r) => r.id ?? String(r.cells.company)));
  return [...out.filter((g) => !restKeys.has(g.key)), ...out.filter((g) => restKeys.has(g.key))];
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
  const grouped = groups.reduce((s, g) => s + g.seen, 0);
  const useGroups = chance !== null && grouped === chance.n && groups.length > 0;
  const [picked, setPicked] = useState<string | undefined>(groups.find((g) => g.target)?.key);

  const thin = result.confidence === "low" || (chance ? chance.n < 10 : false);
  const examples = result.warnings.filter((w) => /^example data/i.test(w));
  const cautions = result.warnings.filter((w) => !/^example data/i.test(w));
  const evidence = <EvidenceKey n={chance?.n} coverage={coverageOf(result)} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />;

  const country = typeof cohort?.filters?.country === "string" ? cohort.filters.country : undefined;
  const role = typeof cohort?.filters?.role === "string" ? cohort.filters.role : undefined;
  const widenHref = country && role ? toolHref("internship_chances", { country }) : null;

  const percent = chance && chance.share !== null ? Math.round(chance.share * 100) : null;
  const lo = chance?.ci ? fmtPct(chance.ci[0]) : null;
  const hi = chance?.ci ? fmtPct(chance.ci[1]) : null;

  return (
    <div className={styles.view}>
      {(result.summary || examples.length > 0) && (
        <Panel title="What this tells you" evidence={evidence}>
          {result.summary && <p className={styles.say}>{result.summary}</p>}
          <p className={styles.sure}>How sure: {result.confidence}. {CONF[result.confidence]}</p>
          {examples.length > 0 && (
            <p className={styles.badgeRow}>
              <ExampleBadge />
            </p>
          )}
        </Panel>
      )}

      {(thin || cohort?.widened || cautions.length > 0) && (
        <Panel title={thin ? "Not enough people to give a chance" : "Worth knowing"}>
          {cohort?.widened && cohort.widened_reason && <p>{cohort.widened_reason}</p>}
          {thin && (
            <p>
              We found only {chance ? fmtInt(chance.n) : "a few"} people like you here. With so few, one more or one less would change the
              answer, so we show the counts and no percentage. This says nothing bad about your chances. It says we cannot see enough yet.
            </p>
          )}
          {cautions.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {thin && widenHref && (
            <p className={styles.actions}>
              <ButtonLink variant="secondary" size="sm" href={widenHref}>
                Look at any role in {country}
              </ButtonLink>
            </p>
          )}
        </Panel>
      )}

      {chance && (
        <div className={styles.hero}>
          <div className={styles.chance}>
            <p className={styles.least}>{thin ? "Out of" : "About"}</p>
            <div className={styles.numeral}>
              {percent !== null ? (
                <>
                  <GridNumber value={percent} cell={32} label={`${percent} percent`} />
                  <span className={styles.pct} aria-hidden="true">
                    %
                  </span>
                </>
              ) : (
                <GridNumber value={chance.n} cell={32} label={`${chance.n} people`} />
              )}
            </div>
            <p className={styles.chanceSay}>
              {percent !== null
                ? `of interns and working students like you ${chanceLabel.replace(/^interns and working students /, "")}.`
                : `${chance.k} of them ${chanceLabel.replace(/^interns and working students /, "")}. That is too few to call a chance.`}
            </p>
            <p className={styles.count}>
              <CountDisplay count={chance} size="lg" />
            </p>
            {lo && hi && (
              <p className={styles.range}>
                Likely between {lo} and {hi}. The more people we see, the narrower this gets.
              </p>
            )}
          </div>

          <Panel
            title={`The ${fmtInt(chance.n)} people like you`}
            caption="Each square is one intern or working student like you. Filled squares went full-time at the same company."
            evidence={evidence}
            className={styles.cellsPanel}
          >
            <CellGrid chance={chance} groups={useGroups ? groups : []} picked={picked} />
            {useGroups && groups.length > 1 && (
              <div className={styles.chips} role="group" aria-label="Highlight a company">
                {groups.map((g) => (
                  <Chip
                    key={g.key}
                    selected={picked === g.key}
                    onClick={() => setPicked((cur) => (cur === g.key ? undefined : g.key))}
                  >
                    {g.company} · {g.converted} of {g.seen}
                  </Chip>
                ))}
              </div>
            )}
            <ul className={styles.legend} role="list">
              <li>
                <i className={styles.keyFull} aria-hidden="true" /> Went full-time at the same company · {chance.k}
              </li>
              <li>
                <i className={styles.keyHollow} aria-hidden="true" /> Did not, as far as we can see · {chance.n - chance.k}
              </li>
              {picked && (
                <li>
                  <i className={styles.keyPick} aria-hidden="true" /> Selected company
                </li>
              )}
            </ul>
          </Panel>
        </div>
      )}

      {companies && <SectionView section={companies} evidence={result.evidence} result={result} />}
      {method && <SectionView section={method} evidence={result.evidence} result={result} />}

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

function CellGrid({ chance, groups, picked }: { chance: Count; groups: Group[]; picked?: string }) {
  const total = chance.n;
  if (groups.length === 0) {
    // No company breakdown that adds up: one run of cells, converted first.
    return (
      <div
        className={styles.cells}
        role="img"
        aria-label={`${chance.k} of ${chance.n} people like you went full-time at the same company`}
      >
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            className={`${styles.cell} ${i < chance.k ? styles.full : styles.hollow} ad-assemble`}
            style={{ ["--i" as string]: i, ["--n" as string]: total }}
          />
        ))}
      </div>
    );
  }
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((sum, x) => sum + x.seen, 0));
  return (
    <ul className={styles.groups} role="list">
      {groups.map((g, gi) => {
        const start = starts[gi];
        const on = picked === g.key;
        return (
          <li
            key={g.key}
            className={styles.group}
            role="img"
            aria-label={`${g.company}: ${g.converted} of ${g.seen} went full-time`}
          >
            <span className={styles.groupName}>{g.company}</span>
            <span className={styles.cells}>
              {Array.from({ length: g.seen }, (_, i) => (
                <i
                  key={i}
                  className={[
                    styles.cell,
                    i < g.converted ? styles.full : styles.hollow,
                    on && styles.pick,
                    "ad-assemble",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ ["--i" as string]: start + i, ["--n" as string]: total }}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
