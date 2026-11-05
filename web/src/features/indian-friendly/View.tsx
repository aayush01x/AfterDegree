"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { ResultView, SectionView } from "@/components/data/ResultView";
import { useDrill } from "@/components/drill/useDrill";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CohortCard, HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { drillOf } from "@/components/data/Drillable";
import type { DrillToken } from "@/lib/drill-types";
import { makeCount, isCount } from "@/lib/count";
import { fmtInt, fmtPct } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type { CellValue, Count, RankedRow, RankedTableData, ResultEnvelope, Section } from "@/lib/types";
import { config, countryOptions } from "./config";
import { EmployerTiles } from "./EmployerTiles";
import styles from "./View.module.css";

/* ---------- reading the ranked_table section into employers ---------- */

type Senior = Count | string | number | null;

interface Employer {
  id: string;
  name: string;
  hires: number;
  recent: number;
  senior: Senior;
  tenure: number | null;
  signals: string[];
  cities: string[];
  roles: string[];
  rest: boolean;
  drill: DrillToken | null;
}

const num = (v: CellValue | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: CellValue | undefined): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

function toEmployer(row: RankedRow, i: number): Employer {
  const c = row.cells;
  const name = typeof c.employer === "string" ? c.employer : typeof c.name === "string" ? c.name : "Unnamed employer";
  const seniorRaw = c.senior ?? c.seniority ?? null;
  const senior: Senior = isCount(seniorRaw) ? seniorRaw : typeof seniorRaw === "string" || typeof seniorRaw === "number" ? seniorRaw : null;
  const signals = strs(c.signals);
  return {
    id: row.id ?? `${name}-${i}`,
    name,
    hires: num(c.hires) ?? row.count?.k ?? 0,
    recent: num(c.recent) ?? 0,
    senior,
    tenure: num(c.tenure),
    signals: signals.length ? signals : row.badges ?? [],
    cities: strs(c.cities),
    roles: strs(c.roles),
    rest: Boolean(row.rest),
    drill: row.rest ? null : (drillOf(row) ?? null),
  };
}

/** Rows under the minimum fold into "Other employers", so no small group stands out. */
function foldSmall(list: Employer[], min: number): Employer[] {
  const keep = list.filter((e) => e.rest || e.hires >= min);
  const small = list.filter((e) => !e.rest && e.hires < min);
  if (!small.length) return list;
  const rest = keep.find((e) => e.rest);
  const hires = small.reduce((a, e) => a + e.hires, 0);
  const recent = small.reduce((a, e) => a + e.recent, 0);
  if (rest) {
    const sCounts = [rest.senior, ...small.map((e) => e.senior)];
    const merged = sCounts.every(isCount)
      ? makeCount(
          (sCounts as Count[]).reduce((a, c) => a + c.k, 0),
          (sCounts as Count[]).reduce((a, c) => a + c.n, 0),
        )
      : rest.senior;
    return keep.map((e) => (e === rest ? { ...rest, hires: rest.hires + hires, recent: rest.recent + recent, senior: merged } : e));
  }
  return [...keep, { id: "other", name: "Other employers", hires, recent, senior: null, tenure: null, signals: [], cities: [], roles: [], rest: true, drill: null }];
}

type SortKey = "hires" | "recent" | "senior" | "tenure";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "hires", label: "Most people seen" },
  { value: "recent", label: "Most recent hires" },
  { value: "senior", label: "Highest share who reached senior or above" },
  { value: "tenure", label: "Longest median stay" },
];

function seniorShare(s: Senior): number {
  if (isCount(s)) return s.share ?? -1;
  if (typeof s === "number") return s;
  return -1;
}

function sortValue(e: Employer, key: SortKey): number {
  if (key === "hires") return e.hires;
  if (key === "recent") return e.recent;
  if (key === "tenure") return e.tenure ?? -1;
  return seniorShare(e.senior);
}

/* ---------- pieces ---------- */

function PeopleCells({ hires, recent, per, label }: { hires: number; recent: number; per: number; label: string }) {
  const total = Math.max(1, Math.ceil(hires / per));
  const solid = Math.min(total, Math.ceil(recent / per));
  return (
    <span className={styles.cells} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < solid ? styles.solid : styles.hollow} />
      ))}
    </span>
  );
}

function SeniorCell({ senior }: { senior: Senior }) {
  if (isCount(senior)) {
    const range = senior.ci ? `, 95% range ${fmtPct(senior.ci[0])} to ${fmtPct(senior.ci[1])}` : "";
    return (
      <span className={styles.stat} title={`${senior.display}${range}`}>
        {senior.share !== null ? <b>{fmtPct(senior.share)}</b> : <b className={styles.dash}>–</b>}
        <small>{senior.display}</small>
      </span>
    );
  }
  if (typeof senior === "number") return <span className={styles.stat}><b>{fmtPct(senior)}</b></span>;
  if (typeof senior === "string") return <span className={styles.stat}><b className={styles.word}>{senior}</b></span>;
  return <span className={styles.stat}><b className={styles.dash}>–</b></span>;
}

function Signals({ signals, rest }: { signals: string[]; rest: boolean }) {
  if (rest) return <span className={styles.none}>Not checked for grouped employers</span>;
  if (!signals.length) return <span className={styles.none}>No signal seen</span>;
  return (
    <ul className={styles.badges} role="list">
      {signals.map((s) => (
        <li key={s} className={styles.badge}>
          {s}
        </li>
      ))}
    </ul>
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
  const table = result.sections.find((s): s is Extract<Section, { kind: "ranked_table" }> => s.kind === "ranked_table");
  const method = result.sections.find((s) => s.kind === "text");
  const others = result.sections.filter((s) => s !== table && s !== method);

  if (!table) return <ResultView result={result} />;
  return <Screen result={result} table={table} method={method} others={others} />;
}

function Screen({
  result,
  table,
  method,
  others,
}: {
  result: ResultEnvelope;
  table: Extract<Section, { kind: "ranked_table" }>;
  method?: Section;
  others: Section[];
}) {
  const data: RankedTableData = table.data;
  const router = useRouter();
  const drill = useDrill();
  const employers = useMemo(() => foldSmall(data.rows.map(toEmployer), config.minRowSize), [data.rows]);
  const named = employers.filter((e) => !e.rest);

  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<SortKey>("hires");

  const roles = useMemo(() => Array.from(new Set(named.flatMap((e) => e.roles))).sort(), [named]);
  const cities = useMemo(() => Array.from(new Set(named.flatMap((e) => e.cities))).sort(), [named]);
  const filtering = Boolean(role || city);

  const sorted = useMemo(() => {
    const keep = named.filter((e) => (!role || e.roles.includes(role)) && (!city || e.cities.includes(city)));
    keep.sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || b.hires - a.hires);
    return keep;
  }, [named, role, city, sort]);
  const shown = useMemo(() => (filtering ? sorted : [...sorted, ...employers.filter((e) => e.rest)]), [sorted, employers, filtering]);

  const biggest = Math.max(1, ...employers.map((e) => e.hires));
  const per = biggest > 400 ? Math.ceil(biggest / 200) : 1;
  const filters = result.cohort?.filters ?? {};
  const country = typeof filters.work_country === "string" ? (filters.work_country as string) : null;
  const searchRole = typeof filters.role === "string" ? (filters.role as string) : "";

  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));
  const first = result.next_steps[0];
  const thin = result.confidence === "low" || (data.n ?? 0) < 100;
  const total = employers.reduce((a, e) => a + e.hires, 0);
  const people = shown.reduce((a, e) => a + e.hires, 0);
  const countries = useMemo(() => countryOptions(country), [country]);

  // A new country is a new search: ToolLayout re-prefills the form from the URL and runs again.
  const pickCountry = (next: string) => {
    if (!next || next === country) return;
    router.push(toolHref("indian_friendly", { country: next, ...(searchRole ? { role: searchRole } : {}) }));
  };

  return (
    <div className={styles.root}>
      <ToolHero
        lead={thin ? "So far" : "At least"}
        numeral={<HeroNumber value={named.length} label={`${named.length} employers`} />}
        say={`${named.length === 1 ? "employer" : "employers"}${country ? ` in ${country}` : ""} have each hired ${config.minRowSize} or more people who studied in India.`}
        actions={first && <ButtonLink href={toolHref(first.tool, first.params)}>{first.label}</ButtonLink>}
        aside={<CohortCard result={result} n={result.cohort?.n_visible ?? data.n} />}
      />

      {result.summary && <p className={styles.summary}>{result.summary}</p>}
      <Notes lines={[...(thin ? ["Few people match, so treat the order below as rough."] : []), ...warnings]} />

      <EmployerTiles employers={shown.filter((e) => !e.rest).slice(0, 10)} country={country} />

      <Panel
        title={table.title}
        headingLevel={2}
        evidence={<EvidenceKey n={data.n} date={result.data_date} evidence={result.evidence} note={result.coverage_note} />}
        caption={data.caption}
        className={styles.main}
      >
        <div className={styles.filters}>
          <Select label="Country" value={country ?? ""} onChange={(e) => pickCountry(e.target.value)} options={countries} />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[{ value: "", label: "Any role" }, ...roles.map((r) => ({ value: r, label: r }))]}
            disabled={!roles.length}
          />
          <Select
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            options={[{ value: "", label: "Any city" }, ...cities.map((c) => ({ value: c, label: c }))]}
            disabled={!cities.length}
          />
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} options={SORTS} />
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRole("");
                setCity("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className={styles.legend} aria-hidden="true">
          <span>
            <i className={styles.solid} /> Started in the last {config.recentMonths} months
          </span>
          <span>
            <i className={styles.hollow} /> Started earlier
          </span>
          <span className={styles.each}>{per === 1 ? "One square is one person." : `One square is up to ${per} people.`}</span>
        </div>

        {filtering && (
          <p className={styles.filterNote} role="status">
            Showing {sorted.length} {sorted.length === 1 ? "employer" : "employers"}
            {city ? ` with people in ${city}` : ""}
            {role && city ? " and" : ""}
            {role ? ` with ${role} roles` : ""}. Counts are for {country ?? "all of the country"}, not only the filter.
          </p>
        )}

        {shown.length === 0 ? (
          <p className={styles.empty}>
            No listed employer matches both filters yet. That can mean small numbers, not that none exist. Try any city or any role.
          </p>
        ) : (
          <table className={styles.table}>
            <caption className="visually-hidden">
              {table.title}: people seen per employer, with seniority reached, median stay and visa signals. Each employer opens its company profile.
            </caption>
            <thead>
              <tr>
                <th scope="col">Employer</th>
                <th scope="col">People seen</th>
                <th scope="col">Senior or above</th>
                <th scope="col">Median stay</th>
                <th scope="col">Visa signals</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr
                  key={e.id}
                  className={[styles.row, "ad-assemble", e.drill && styles.link, e.rest && styles.rest].filter(Boolean).join(" ")}
                  style={{ ["--i" as string]: i, ["--n" as string]: shown.length }}
                >
                  <th scope="row" className={styles.name}>
                    {e.drill ? (
                      <button type="button" className={styles.pick} onClick={() => drill.open(e.drill!, e.name)} aria-label={`${e.name}: ${fmtInt(e.hires)} people seen. Open the company profile`}>
                        <span className={styles.empName}>{e.name}</span>
                        <span className={styles.where}>{e.cities.slice(0, 3).join(", ")}</span>
                      </button>
                    ) : (
                      <span className={styles.pick}>
                        <span className={styles.empName}>{e.rest ? "Other employers" : e.name}</span>
                        <span className={styles.where}>{e.rest ? "each with fewer than 5 people" : e.cities.slice(0, 3).join(", ")}</span>
                      </span>
                    )}
                  </th>
                  <td data-label="People seen">
                    <div className={styles.people}>
                      <PeopleCells
                        hires={e.hires}
                        recent={e.recent}
                        per={per}
                        label={`${e.hires} Indian-educated people seen, ${e.recent} started in the last ${config.recentMonths} months`}
                      />
                      <span className={styles.tally}>
                        <b>{fmtInt(e.hires)}</b>
                        <small>{fmtInt(e.recent)} recent</small>
                      </span>
                    </div>
                  </td>
                  <td data-label="Senior or above">
                    <SeniorCell senior={e.senior} />
                  </td>
                  <td data-label="Median stay">
                    {e.tenure !== null ? (
                      <span className={styles.stat}>
                        <b>{e.tenure.toFixed(1)}</b>
                        <small>years</small>
                      </span>
                    ) : (
                      <span className={styles.stat}>
                        <b className={styles.dash}>–</b>
                      </span>
                    )}
                  </td>
                  <td data-label="Visa signals">
                    <Signals signals={e.signals} rest={e.rest} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.tableFoot}>
          {fmtInt(filtering ? people : total)} people shown. Signals are facts we saw, never promises: a missing badge means no
          signal seen, not a no.
        </p>
      </Panel>

      <div className={styles.lower}>
        {method && method.kind === "text" && (
          <Panel title={method.title} headingLevel={2} className={styles.method}>
            <Paragraphs text={method.data.text} />
          </Panel>
        )}
      </div>

      {others.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: result.next_steps.slice(1) }} primary={false} />
    </div>
  );
}
