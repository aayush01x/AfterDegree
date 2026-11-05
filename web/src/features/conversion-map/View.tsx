"use client";

import Form from "next/form";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { DrillToken } from "@/lib/drill-types";
import { drillOf, pressable } from "@/components/tool/drill";
import { HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { useDrill } from "@/components/drill/useDrill";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { Panel } from "@/components/data/Panel";
import { SectionView } from "@/components/data/ResultView";
import { CompanyMark } from "@/components/art/CompanyMark";
import { PosterTile } from "@/components/tiles/PosterTile";
import { TileRow } from "@/components/tiles/TileRow";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { makeCount } from "@/lib/count";
import { formatDate, fmtPct } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type {
  Count,
  DistributionData,
  RankedRow,
  RankedTableData,
  ResultEnvelope,
  Section,
  StatData,
  TextData,
} from "@/lib/types";
import styles from "./View.module.css";

type SortKey = "chance" | "volume";

interface Rung {
  id: string;
  name: string;
  country: string;
  count: Count;
  rest: boolean;
  drill: DrillToken | null;
}

const MIN_FOR_SHARE = 10;

/* ---------- reading the result ---------- */

function cellText(row: RankedRow, key: string): string {
  const v = row.cells[key];
  return typeof v === "string" ? v : "";
}

function toRung(row: RankedRow, i: number): Rung | null {
  const seen = row.cells.seen;
  const conv = row.cells.converted;
  const count =
    row.count ?? (typeof seen === "number" && typeof conv === "number" ? makeCount(conv, seen) : null);
  if (!count) return null;
  return {
    id: row.id ?? `row-${i}`,
    name: cellText(row, "company") || "Unnamed company",
    country: cellText(row, "country"),
    count,
    rest: Boolean(row.rest),
    drill: row.rest ? null : (drillOf(row) ?? null),
  };
}

const rate = (c: Count) => (c.n > 0 ? c.k / c.n : 0);
const thin = (c: Count) => c.n < MIN_FOR_SHARE;

function sortRungs(rungs: Rung[], by: SortKey): Rung[] {
  const body = rungs.filter((r) => !r.rest);
  const rest = rungs.filter((r) => r.rest);
  const cmp =
    by === "volume"
      ? (a: Rung, b: Rung) => b.count.n - a.count.n || rate(b.count) - rate(a.count)
      : (a: Rung, b: Rung) =>
          Number(thin(a.count)) - Number(thin(b.count)) || rate(b.count) - rate(a.count) || b.count.n - a.count.n;
  return [...body].sort(cmp).concat(rest);
}

function isCompanyTable(s: Section): s is Extract<Section, { kind: "ranked_table" }> {
  return s.kind === "ranked_table" && s.data.columns.some((c) => c.key === "company");
}

/* ---------- ladder pieces ---------- */

function Cells({ count, start, total, label }: { count: Count; start: number; total: number; label: string }) {
  const cells = [];
  for (let i = 0; i < count.n; i++) {
    cells.push(
      <i
        key={i}
        className={["ad-assemble", styles.cell, i < count.k ? styles.filled : styles.hollow].join(" ")}
        style={{ ["--i" as string]: start + i, ["--n" as string]: total }}
      />,
    );
  }
  return (
    <span className={styles.cells} role="img" aria-label={label}>
      {cells}
    </span>
  );
}

function detailFor(r: Rung): string {
  const { count: c } = r;
  const where = r.country && r.country !== "Various" ? ` (${r.country})` : "";
  const base = `${r.name}${where}: ${c.display} interns and working students went full-time.`;
  if (c.ci && c.share !== null) {
    return `${base} That is about ${fmtPct(c.share)}, and the true figure is likely between ${fmtPct(c.ci[0])} and ${fmtPct(c.ci[1])}.`;
  }
  return `${base} That is too few people to turn into a percentage.`;
}

/* ---------- country distribution ---------- */

interface CountryRow {
  label: string;
  converted: number;
  count: Count | null;
  target: boolean;
  remainder: boolean;
  drill: DrillToken | null;
}

function countryRows(dist: DistributionData, rungs: Rung[]): CountryRow[] {
  return dist.items.map((it) => {
    const mine = it.remainder ? rungs.filter((r) => r.rest) : rungs.filter((r) => !r.rest && r.country === it.label);
    const n = mine.reduce((a, r) => a + r.count.n, 0);
    const k = mine.reduce((a, r) => a + r.count.k, 0);
    return {
      label: it.label,
      converted: it.count,
      count: n > 0 ? makeCount(k, n) : null,
      target: Boolean(it.target),
      remainder: Boolean(it.remainder),
      drill: it.remainder ? null : (drillOf(it) ?? null),
    };
  });
}

const BAR_CELLS = 20;

function CountryPanel({
  section,
  rungs,
  evidenceNode,
}: {
  section: Extract<Section, { kind: "distribution" }>;
  rungs: Rung[];
  evidenceNode: ReactNode;
}) {
  const drill = useDrill();
  const rows = useMemo(() => countryRows(section.data, rungs), [section.data, rungs]);
  return (
    <Panel
      title={section.title}
      evidence={evidenceNode}
      caption={section.data.caption ?? "Each square is 5% of the people we saw in that country."}
      as="section"
    >
      <ul className={styles.countries} role="list">
        {rows.map((r) => {
          const c = r.count;
          const enough = c !== null && !thin(c);
          const lit = enough ? Math.round(rate(c) * BAR_CELLS) : 0;
          const inner = (
            <>
              <span className={styles.countryName}>
                {r.label}
                {r.target && <small className={styles.tag}>Target</small>}
              </span>
              <span
                className={styles.pct}
                role="img"
                aria-label={enough ? `About ${fmtPct(c.share)} went full-time` : "Too few people for a percentage"}
              >
                {Array.from({ length: BAR_CELLS }, (_, i) => (
                  <i
                    key={i}
                    className={[styles.cell, styles.sm, !enough ? styles.dashed : i < lit ? styles.filled : styles.hollow].join(" ")}
                  />
                ))}
              </span>
              <span className={styles.countryNum}>
                {enough ? <b>{fmtPct(c.share)}</b> : <b aria-hidden="true">–</b>}
                <span>{c ? c.display : `${r.converted} went full-time`}</span>
              </span>
            </>
          );
          return (
            <li key={r.label}>
              {r.drill ? (
                <div
                  className={[styles.countryRow, styles.hit].join(" ")}
                  data-target={r.target || undefined}
                  aria-label={`${r.label}: open the people`}
                  {...pressable(() => drill.open(r.drill as DrillToken, r.label))}
                >
                  {inner}
                </div>
              ) : (
                <div className={styles.countryRow} data-target={r.target || undefined}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ---------- the view ---------- */

export function View({ result }: { result: ResultEnvelope }) {
  const uid = useId();
  const drill = useDrill();
  const [sort, setSort] = useState<SortKey>("chance");
  const [country, setCountry] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [tileFocus, setTileFocus] = useState<string | null>(null);

  const table = result.sections.find(isCompanyTable);
  const dist = result.sections.find((s): s is Extract<Section, { kind: "distribution" }> => s.kind === "distribution");
  const stat = result.sections.find((s): s is Extract<Section, { kind: "stat" }> => s.kind === "stat");
  const used = new Set([table?.id, dist?.id, stat?.id].filter(Boolean) as string[]);
  const others = result.sections.filter((s) => !used.has(s.id));

  const rungs = useMemo(
    () => (table ? (table.data as RankedTableData).rows.map(toRung).filter((r): r is Rung => r !== null) : []),
    [table],
  );
  const countries = useMemo(
    () => [...new Set(rungs.filter((r) => !r.rest && r.country).map((r) => r.country))].sort(),
    [rungs],
  );

  const visible = useMemo(() => {
    const filtered = country ? rungs.filter((r) => r.rest || r.country === country) : rungs;
    return sortRungs(country ? filtered.filter((r) => !r.rest) : filtered, sort);
  }, [rungs, sort, country]);

  /* the companies that turn the most interns into employees, for the tile row */
  const top = useMemo(() => {
    const body = rungs.filter((r) => !r.rest);
    const enough = body.filter((r) => !thin(r.count));
    return sortRungs(enough.length > 0 ? enough : body, enough.length > 0 ? "chance" : "volume").slice(0, 8);
  }, [rungs]);
  const focusId = top.find((r) => r.id === tileFocus)?.id ?? top[0]?.id;

  const totalCells = visible.reduce((a, r) => a + r.count.n, 0);
  const offsets = visible.map((_, i) => visible.slice(0, i).reduce((a, r) => a + r.count.n, 0));

  const cohort = result.cohort;
  const filters = (cohort?.filters ?? {}) as Record<string, unknown>;
  const filterStr = (k: string) => (typeof filters[k] === "string" ? (filters[k] as string) : "");
  const hasEnough = rungs.some((r) => !r.rest && !thin(r.count));
  const isThin = result.confidence === "low" || Boolean(cohort?.widened) || (rungs.length > 0 && !hasEnough);

  /* What the widen button drops: college first, then country, then role. */
  const scope: Record<string, string> = {};
  for (const k of ["school", "field", "country", "role"]) if (filterStr(k)) scope[k] = filterStr(k);
  const dropOrder = ["school", "country", "role"].filter((k) => scope[k]);
  const widenDrop = dropOrder[0];
  const widened = { ...scope };
  if (widenDrop) delete widened[widenDrop];
  const widenWord: Record<string, string> = { school: "all colleges", country: "any country", role: "any role" };

  const selectedRung = visible.find((r) => r.id === selected) ?? null;
  const overall = stat?.data as StatData | undefined;
  const realWarnings = result.warnings.filter((w) => !/mock mode/i.test(w));

  const evNode = (
    <EvidenceKey n={cohort?.n_visible} date={formatDate(result.data_date)} evidence={result.evidence} />
  );

  const sumN = rungs.reduce((a, r) => a + r.count.n, 0);
  const sumK = rungs.reduce((a, r) => a + r.count.k, 0);
  const oc = overall?.count ?? (sumN > 0 ? makeCount(sumK, sumN) : null);
  const percent = oc && oc.share !== null ? Math.round(oc.share * 100) : null;
  const notes = [
    ...(isThin
      ? [
          `${cohort?.widened_reason ?? "We found only a few interns and working students that match, so these figures can swing a lot."} That is not a bad sign for you. It only means the data is thin, so read the squares as hints, not as a verdict.`,
        ]
      : []),
    ...realWarnings,
  ];
  const [firstStep, ...otherSteps] = result.next_steps;

  return (
    <div className={styles.root}>
      {/* 1. The answer */}
      {oc && (
        <ToolHero
          lead={percent === null ? "Out of" : "About"}
          numeral={
            percent !== null ? (
              <div className={styles.numeral}>
                <HeroNumber value={percent} label={`${percent} percent`} />
                <span className={styles.pctMark} aria-hidden="true">
                  %
                </span>
              </div>
            ) : (
              <HeroNumber value={oc.n} label={`${oc.n} people`} />
            )
          }
          say={
            percent !== null
              ? `of interns and working students went full-time at the same company.`
              : `${oc.k} of them went full-time at the same company. That is too few to call a chance.`
          }
          note={
            <>
              {result.summary}
              {overall?.note ? ` ${overall.note}` : ""}
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

      {/* 2. Who is counted, and a warm note when the data is thin */}
      {(cohort || notes.length > 0) && (
        <div className={styles.context}>
          {cohort && (
            <aside className={styles.cohortCard} aria-label="Who is counted">
              <div className={styles.cardHead}>
                <h2>Who is counted</h2>
                {evNode}
              </div>
              <p>{cohort.definition}.</p>
              {oc && <p className={styles.muted}>{oc.display} went full-time at the same company.</p>}
            </aside>
          )}
          {notes.length > 0 && (
            <div className={styles.notice}>
              <Notes lines={notes} />
              {isThin && widenDrop && (
                <ButtonLink href={toolHref("conversion_map", { scope: widened })} variant="secondary" size="sm">
                  Look again across {widenWord[widenDrop]}
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Companies that turn interns into employees */}
      {top.length > 0 && (
        <TileRow
          title="Top converters"
          note={`${top.length} ${top.length === 1 ? "company" : "companies"} · went full-time, of the interns we saw`}
          label="Companies that convert interns"
        >
          {top.map((r) => {
            const on = r.id === focusId;
            return (
              <PosterTile
                key={r.id}
                variant="card"
                title={r.name}
                art={<CompanyMark name={r.name} shape="landscape" />}
                count={r.count.k}
                unit={`of ${r.count.n}`}
                expanded={on}
                note={thin(r.count) ? "Counts only" : undefined}
                countLine={`at least ${r.count.k} of ${r.count.n} went full-time`}
                details={
                  on ? (
                    <p className={styles.tileSay}>
                      {detailFor(r).replace(/^[^:]+: /, "")}
                      {r.country && r.country !== "Various" ? ` Based in ${r.country}.` : ""}
                    </p>
                  ) : undefined
                }
                drill={on ? r.drill : null}
                drillLabel={`See the ${r.count.n} at ${r.name}`}
                onSelect={on ? undefined : () => setTileFocus(r.id)}
              />
            );
          })}
        </TileRow>
      )}

      {/* 4. Signature: the ladder */}
      {table && (
        <Panel
          title="The ladder: who turns interns into employees"
          evidence={evNode}
          caption={
            table.data.caption ??
            "One square is one intern or working student. Filled means they went full-time at that company."
          }
          as="section"
          className={styles.ladderPanel}
        >
          <div className={styles.controls}>
            <div className={styles.sort} role="group" aria-label="Sort the ladder">
              <Chip selected={sort === "chance"} onClick={() => setSort("chance")}>
                Highest chance
              </Chip>
              <Chip selected={sort === "volume"} onClick={() => setSort("volume")}>
                Most people
              </Chip>
            </div>
            <Select
              label="Show country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setSelected(null);
              }}
              options={[{ value: "", label: "All countries" }, ...countries.map((c) => ({ value: c, label: c }))]}
              className={styles.countrySelect}
            />
          </div>

          <div className={styles.legend} aria-hidden="true">
            <span>
              <i className={[styles.cell, styles.filled].join(" ")} /> Went full-time
            </span>
            <span>
              <i className={[styles.cell, styles.hollow].join(" ")} /> Did not (that we can see)
            </span>
            {sort === "chance" && <span>Companies with fewer than {MIN_FOR_SHARE} people are listed after the others.</span>}
          </div>

          {visible.length === 0 ? (
            <p className={styles.empty}>No companies in this country yet. Try another country, or look at all of them.</p>
          ) : (
            <ol className={styles.ladder} aria-label="Companies ranked">
              {visible.map((r, idx) => {
                const start = offsets[idx];
                const on = r.id === selected;
                const open = () => {
                  setSelected(on && !r.drill ? null : r.id);
                  if (r.drill) drill.open(r.drill, r.name);
                };
                return (
                  <li key={r.id} className={[styles.rung, on ? styles.on : "", r.rest ? styles.rest : ""].join(" ")}>
                    <div
                      className={styles.pick}
                      aria-label={r.drill ? `${r.name}: open the people` : `${r.name}: show the figures`}
                      aria-pressed={r.drill ? undefined : on}
                      {...pressable(open)}
                    >
                      <span className={styles.rank}>{r.rest ? "" : idx + 1}</span>
                      <span className={styles.who}>
                        <b>{r.name}</b>
                        {r.country && <span>{r.country}</span>}
                      </span>
                      <Cells
                        count={r.count}
                        start={start}
                        total={totalCells}
                        label={`${r.count.k} of ${r.count.n} went full-time`}
                      />
                      <span className={styles.count}>
                        {thin(r.count) ? `${r.count.k} of ${r.count.n}` : r.count.display}
                        {r.count.share !== null && <span className={styles.share}>{fmtPct(r.count.share)}</span>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <p className={styles.detail} aria-live="polite">
            {selectedRung ? detailFor(selectedRung) : "Choose a company to open the people behind its figures."}
          </p>

          <Form action="/tools/conversion-map" className={styles.narrow} aria-labelledby={`${uid}-narrow`}>
            <h3 id={`${uid}-narrow`} className={styles.narrowTitle}>
              Narrow it to your college or field
            </h3>
            {Object.entries(scope)
              .filter(([k]) => k === "country" || k === "role")
              .map(([k, v]) => (
                <input key={k} type="hidden" name={`scope.${k}`} value={v} />
              ))}
            <Input label="College" name="scope.school" defaultValue={scope.school ?? ""} placeholder="Any college" optional />
            <Input label="Field" name="scope.field" defaultValue={scope.field ?? ""} placeholder="e.g. Computer Science" optional />
            <Button type="submit" variant="secondary" size="sm" className={styles.apply}>
              Update the map
            </Button>
          </Form>
        </Panel>
      )}

      {/* 5. Supporting panels */}
      <div className={styles.support}>
        {dist && <CountryPanel section={dist} rungs={rungs} evidenceNode={evNode} />}
        {others
          .filter((s) => s.kind === "text")
          .map((s) => (
            <Panel key={s.id} title={s.title} as="section">
              <p className={styles.prose}>{(s.data as TextData).text}</p>
            </Panel>
          ))}
      </div>
      {others
        .filter((s) => s.kind !== "text")
        .map((s) => (
          <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
        ))}

      <ResultFoot result={{ ...result, next_steps: otherSteps }} />
    </div>
  );
}
