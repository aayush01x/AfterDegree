"use client";
// Company profile (CONTRACT Appendix D): a drill whose last step is a company. People numbers
// keep the inherited filters (filled square); facts about the company itself are company-wide
// (hollow square). Every people row opens its own drill.
import type { ReactNode } from "react";
import type { CompanyProfile, DrillResultFull, DrillToken } from "@/lib/drill-types";
import type { Count, Evidence, RouteListItem, Section, TimeseriesData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { useProfile } from "@/components/shell/ProfileContext";
import { CompanyMark } from "@/components/art/CompanyMark";
import { PlaceArt } from "@/components/art/PlaceArt";
import { RouteArt } from "@/components/art/RouteArt";
import { CellDigits } from "@/components/data/CellDigits";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { Drillable } from "@/components/data/Drillable";
import { TileRow } from "@/components/tiles/TileRow";
import { PosterTile } from "@/components/tiles/PosterTile";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { Tag } from "@/components/ui/Tag";
import { DrillHeader } from "./DrillHeader";
import { PeopleRow } from "./PeopleRow";
import { DrillFooter } from "./DrillFooter";
import { isExample, rowsOf, sectionById, type BreakdownRow } from "./rows";
import { drillHref, tokenAtLevel } from "./token";
import styles from "./Company.module.css";

/* ---------- small pieces ---------- */

/** Filled square: uses your filters. Hollow square: company-wide. */
function Scope({ wide, label }: { wide?: boolean; label?: string }) {
  return (
    <span className={styles.scope} title={label ?? (wide ? "Company-wide" : "Uses your filters")}>
      <i className={wide ? styles.hollow : styles.filled} aria-hidden="true" />
      {label && <span>{label}</span>}
      {!label && <span className="visually-hidden">{wide ? "Company-wide" : "Uses your filters"}</span>}
    </span>
  );
}

function Cells({ n, max = 12, hollow, tone }: { n: number; max?: number; hollow?: boolean; tone?: "accent" | "ink" }) {
  const shown = Math.min(n, max);
  return (
    <span className={styles.bar} aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} className={[hollow && styles.cellHollow, tone === "accent" && styles.cellAccent].filter(Boolean).join(" ")} />
      ))}
      {n > max && <span className={styles.more}>+</span>}
    </span>
  );
}

function Box({ title, scope, keyText, evidence, children, className }: { title: ReactNode; scope?: "filters" | "wide"; keyText?: string; evidence?: Evidence[]; children: ReactNode; className?: string }) {
  return (
    <section className={[styles.box, className].filter(Boolean).join(" ")}>
      <header className={styles.boxHead}>
        <h3 className={styles.boxTitle}>{title}</h3>
        {keyText && (
          <span className={styles.boxKey}>
            {scope && <Scope wide={scope === "wide"} />}
            <EvidenceKey label={keyText} evidence={evidence} />
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** A ranked list of people rows: label, optional tag, cell bar, count. Rows open their drill. */
function PeopleList({ rows, label, youTag }: { rows: BreakdownRow[]; label: string; youTag?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={styles.list} aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <Drillable token={r.drill} label={r.label} className={[styles.listRow, r.you && styles.you, r.rest && styles.rest].filter(Boolean).join(" ")} actionLabel={`${r.label}: ${r.count} people. Open this group`}>
            <span className={styles.listLabel}>
              {r.label.includes(" · ") ? (
                <>
                  <strong>{r.label.split(" · ")[0]}</strong> · {r.label.split(" · ").slice(1).join(" · ")}
                </>
              ) : (
                <strong>{r.label}</strong>
              )}
              {r.you && (r.badges?.[0] ?? youTag) && (
                <Tag tone="accent" className={styles.inlineTag}>
                  {r.badges?.[0] ?? youTag}
                </Tag>
              )}
            </span>
            <Cells n={Math.max(1, Math.round((r.count / max) * 12))} hollow={r.rest} tone={r.you ? "accent" : "ink"} />
            <span className={styles.num}>{r.count}</span>
          </Drillable>
        </li>
      ))}
    </ul>
  );
}

function pct(x: number | null | undefined) {
  if (x == null) return null;
  const v = Math.round(x * 100);
  return `${v > 0 ? "+" : ""}${v}%`;
}

function Kpi({ value, unit, label, sub, wide, evidence }: { value: number | string; unit?: string; label: string; sub: string; wide?: boolean; evidence?: Evidence[] }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiNum}>
          <CellDigits value={value} pitch={5} tone="ink" />
          {unit && <span className={styles.kpiUnit}>{unit}</span>}
        </span>
        <Scope wide={wide} />
      </div>
      <p className={styles.kpiLabel}>{label}</p>
      <EvidenceKey label={sub} evidence={evidence} />
    </div>
  );
}

/* ---------- sections ---------- */

function Facts({ c, evidence, date }: { c: CompanyProfile; evidence: Evidence[]; date?: string }) {
  const india = c.india_presence;
  const facts: { k: string; v: ReactNode; sub?: ReactNode }[] = [
    { k: "Industry", v: c.industry ?? "Not listed" },
    { k: "Headquarters", v: c.hq ? [c.hq.city, c.hq.country].filter(Boolean).join(", ") : "Not listed" },
    { k: "International", v: c.international == null ? "Unknown" : c.international ? "Yes" : "No", sub: c.offices?.length ? `${c.offices.length} offices with people like you` : undefined },
    {
      k: "India presence",
      v: india?.has_india_office ? (india.india_cities?.join(", ") || "Yes") : india ? "No India office found" : "Unknown",
      sub: india?.is_gcc ? "Global capability centre" : undefined,
    },
    {
      k: "Headcount",
      v: c.headcount?.total != null ? `~${fmtInt(c.headcount.total)}` : "Not listed",
      sub: c.headcount?.growth_12m != null ? `${pct(c.headcount.growth_12m)} in 12 months` : undefined,
    },
  ];
  return (
    <section className={styles.facts} aria-labelledby="facts-title">
      <header className={styles.factsHead}>
        <h2 id="facts-title" className={styles.factsTitle}>
          <Scope wide /> Company-wide facts
        </h2>
        <EvidenceKey label={`Source: company enrich${date ? ` · ${date}` : ""}`} evidence={evidence.filter((e) => e.endpoint.startsWith("/company"))} />
      </header>
      <dl className={styles.factGrid}>
        {facts.map((f) => (
          <div key={f.k} className={styles.fact}>
            <dt>{f.k}</dt>
            <dd>
              <span className={f.k === "Headcount" ? styles.factBig : undefined}>{f.v}</span>
              {f.sub && <small>{f.sub}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DegreeWaffle({ section }: { section: Section }) {
  const rows = rowsOf(section);
  const tones = [styles.wInk, styles.wAccent, styles.wHollow];
  const n = rows.reduce((a, r) => a + r.count, 0);
  return (
    <>
      <div className={styles.waffle} role="img" aria-label={rows.map((r) => `${r.label} ${r.count}`).join(", ")}>
        {rows.flatMap((r, gi) => Array.from({ length: r.count }, (_, i) => <i key={`${gi}-${i}`} className={tones[Math.min(gi, 2)]} />))}
      </div>
      <ul className={styles.legend}>
        {rows.map((r, gi) => (
          <li key={r.key}>
            <Drillable token={r.drill} label={r.label} className={styles.legendItem} actionLabel={`${r.label}: ${r.count} people`}>
              <i className={tones[Math.min(gi, 2)]} aria-hidden="true" /> {r.label} <strong>{r.count}</strong>
            </Drillable>
          </li>
        ))}
      </ul>
      {rows[0] && (
        <p className={styles.small}>
          {rows[0].count > n / 2 ? `Most earned their highest degree in ${rows[0].label} before joining.` : "Their highest degrees are spread across countries."} One cell is one person.
        </p>
      )}
    </>
  );
}

function EntryRoutes({ section, n }: { section: Extract<Section, { kind: "route_list" }>; n: number }) {
  const routes = section.data.routes;
  const k = routes.reduce((a, r) => a + (typeof r.people === "number" ? r.people : r.people.k), 0);
  return (
    <Box title="Entry routes" scope="filters" keyText={`${k} of ${n} took these ${routes.length === 1 ? "route" : `${routes.length} routes`}`}>
      <ol className={styles.routes}>
        {routes.map((r: RouteListItem, i) => {
          const people = typeof r.people === "number" ? r.people : r.people.k;
          const tok = (r as { drill?: DrillToken }).drill;
          return (
            <li key={r.id}>
              <Drillable token={tok} label={r.steps.map((s) => s.label).join(" → ")} className={styles.route} actionLabel={`${people} people took ${r.steps.map((s) => s.label).join(", then ")}`}>
                <span className={styles.routeCount}>
                  <CellDigits value={people} pitch={4} tone="ink" />
                  <small>
                    people of {n}
                    {r.typical_years ? <><br />about {r.typical_years} yrs</> : null}
                  </small>
                </span>
                <span className={styles.routeArt}>
                  <RouteArt steps={r.steps.length} hue={(((i % 4) + 1) as 1 | 2 | 3 | 4)} cols={48} rows={7} pitch={6} seed={r.id} label={`Route ${i + 1}`} />
                  <span className={styles.routeSteps}>
                    {r.steps.map((s) => (
                      <span key={s.label}>{s.label}</span>
                    ))}
                  </span>
                </span>
              </Drillable>
            </li>
          );
        })}
      </ol>
      {section.data.caption && <p className={styles.small}>{section.data.caption}</p>}
    </Box>
  );
}

const SERIES_TONES = [styles.sRoute1, styles.sRoute2, styles.sOther];

function JoinedByYear({ data, n, name }: { data: TimeseriesData; n: number; name: string }) {
  const series = data.series ?? (data.points ? [{ key: "all", label: "Joined", points: data.points }] : []);
  const periods = series[0]?.points.map((p) => p.period) ?? [];
  const thisYear = String(new Date().getFullYear());
  return (
    <Box title={`Joined ${name}, by year`} scope="filters" keyText={`N = ${n}`}>
      <div className={styles.years} role="img" aria-label={periods.map((p) => `${p}: ${series.reduce((a, s) => a + (s.points.find((x) => x.period === p)?.value ?? 0), 0)}`).join(", ")}>
        {periods.map((p) => (
          <div key={p} className={styles.yearCol}>
            <div className={[styles.stack, p === thisYear && "ad-dots"].filter(Boolean).join(" ")}>
              {series.flatMap((s, si) => Array.from({ length: s.points.find((x) => x.period === p)?.value ?? 0 }, (_, i) => <i key={`${si}-${i}`} className={SERIES_TONES[Math.min(si, 2)]} />))}
            </div>
            <span className={styles.yearLabel}>{p}</span>
          </div>
        ))}
      </div>
      <ul className={styles.legend}>
        {series.map((s, si) => (
          <li key={s.key} className={styles.legendItem}>
            <i className={SERIES_TONES[Math.min(si, 2)]} aria-hidden="true" /> {s.label}
          </li>
        ))}
        {periods.includes(thisYear) && (
          <li className={styles.legendItem}>
            <i className="ad-dots" aria-hidden="true" /> {thisYear} so far
          </li>
        )}
      </ul>
    </Box>
  );
}

function Hiring({ c, openRoles, targetRole, evidence }: { c: CompanyProfile; openRoles?: Section; targetRole?: string; evidence: Evidence[] }) {
  const h = c.hiring;
  if (!h) return null;
  const total = h.open_postings_90d ?? 0;
  const roles = (h.by_role ?? []).filter((r) => !/^other/i.test(r.label));
  const otherRoles = (h.by_role ?? []).find((r) => /^other/i.test(r.label));
  const maxRole = Math.max(1, ...roles.map((r) => r.count));
  const lang = h.language;
  const langTotal = lang ? (lang.english_only ?? 0) + (lang.german_required ?? 0) + (lang.other ?? 0) : 0;
  const ht = h.hire_through;
  const jobsEv = evidence.filter((e) => e.endpoint === "/job/search");
  const isTarget = (label: string) => !!targetRole && label.toLowerCase().includes(targetRole.toLowerCase());
  const open = openRoles ? rowsOf(openRoles) : [];
  const careersHost = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  return (
    <div className={styles.cols3}>
      <Box title="Open postings by role" scope="wide" keyText={`${fmtInt(total)} postings`} evidence={jobsEv}>
        <ul className={styles.list} aria-label="Open postings by role">
          {roles.map((r) => (
            <li key={r.label}>
              <div className={[styles.listRow, isTarget(r.label) && styles.you].filter(Boolean).join(" ")}>
                <span className={styles.listLabel}>
                  <strong>{r.label}</strong>
                  {isTarget(r.label) && (
                    <Tag tone="accent" className={styles.inlineTag}>
                      Your role
                    </Tag>
                  )}
                </span>
                <Cells n={Math.max(1, Math.round((r.count / maxRole) * 16))} max={16} tone={isTarget(r.label) ? "accent" : "ink"} />
                <span className={styles.num}>{r.count}</span>
              </div>
            </li>
          ))}
          {otherRoles && (
            <li>
              <div className={[styles.listRow, styles.rest].join(" ")}>
                <span className={styles.listLabel}>{otherRoles.label}</span>
                <span />
                <span className={styles.num}>{otherRoles.count}</span>
              </div>
            </li>
          )}
        </ul>
        {h.by_location && h.by_location.length > 0 && (
          <>
            <h4 className={styles.subhead}>By city</h4>
            <dl className={styles.cityGrid}>
              {h.by_location.map((l) => (
                <div key={l.label}>
                  <dt>{l.label}</dt>
                  <dd>{l.count}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Box>

      <Box title="Language asked for" scope="wide" keyText={`${fmtInt(langTotal || total)} postings`} evidence={jobsEv}>
        {lang && langTotal > 0 && (
          <>
            <div className={styles.langWaffle} role="img" aria-label={`English only ${lang.english_only ?? 0}, German required ${lang.german_required ?? 0}, other ${lang.other ?? 0}`}>
              {Array.from({ length: lang.english_only ?? 0 }, (_, i) => <i key={`e${i}`} className={styles.wInk} />)}
              {Array.from({ length: lang.german_required ?? 0 }, (_, i) => <i key={`g${i}`} className={styles.wAccent} />)}
              {Array.from({ length: lang.other ?? 0 }, (_, i) => <i key={`o${i}`} className={styles.wHollow} />)}
            </div>
            <ul className={styles.legend}>
              <li className={styles.legendItem}><i className={styles.wInk} aria-hidden="true" /> English only <strong>{lang.english_only ?? 0}</strong></li>
              <li className={styles.legendItem}><i className={styles.wAccent} aria-hidden="true" /> German required <strong>{lang.german_required ?? 0}</strong></li>
              <li className={styles.legendItem}><i className={styles.wHollow} aria-hidden="true" /> Other <strong>{lang.other ?? 0}</strong></li>
            </ul>
          </>
        )}
        {h.sponsorship_mentions && (
          <div className={styles.subBlock}>
            <h4 className={styles.subhead}>Mentions visa sponsorship</h4>
            <p className={styles.inlineCount}>
              at least <CellDigits value={h.sponsorship_mentions.k} pitch={4} tone="ink" /> of {fmtInt(h.sponsorship_mentions.n)} postings
            </p>
            <EvidenceKey label={`${h.sponsorship_mentions.evidence_ids?.[0] ?? "Evidence"} · text match in posting body`} evidence={evidence.filter((e) => h.sponsorship_mentions?.evidence_ids?.includes(e.id))} />
          </div>
        )}
        {h.median_days_open != null && (
          <div className={styles.subBlock}>
            <h4 className={styles.subhead}>Median time a posting stays open</h4>
            <p className={styles.inlineCount}>
              <CellDigits value={h.median_days_open} pitch={4} tone="ink" /> days
            </p>
            <EvidenceKey label={`n = ${fmtInt(total)} · job search`} evidence={jobsEv} />
          </div>
        )}
      </Box>

      <Box title="Do postings lead to hires?" scope="wide" keyText={ht ? `${ht.postings_seen} postings` : undefined} evidence={jobsEv}>
        {ht ? (
          <>
            <div className={styles.htTop}>
              <span className={styles.htBadge}>
                <span>Hire-through</span>
                <strong>{ht.label === "high" ? "High" : ht.label === "some" ? "Some" : "Unclear"}</strong>
              </span>
              <p className={styles.small}>
                <strong>
                  {ht.matched_hires} of {ht.postings_seen}
                </strong>{" "}
                postings from 3–12 months ago led to a matching hire.
              </p>
            </div>
            <div className={styles.htCells} role="img" aria-label={`${ht.matched_hires} of ${ht.postings_seen} postings led to a hire`}>
              {Array.from({ length: ht.postings_seen }, (_, i) => (
                <i key={i} className={i < ht.matched_hires ? styles.wInk : styles.wHollow} />
              ))}
            </div>
            <p className={styles.small}>
              {ht.note ?? "Older postings matched to people who later started there in a similar role and city."}{" "}
              {ht.label === "high" ? "High: postings here usually turn into hires." : ht.label === "some" ? "Some: a fair share of postings turn into hires." : "Unclear: too few matches to say, which is not a bad sign on its own."}
            </p>
          </>
        ) : (
          <p className={styles.small}>Not enough older postings to tell yet. That is not a bad sign on its own.</p>
        )}
        {open.length > 0 && (
          <div className={styles.subBlock}>
            <h4 className={styles.subhead}>Open now</h4>
            <ul className={styles.jobs}>
              {open.map((j) => {
                const row = openRoles?.kind === "ranked_table" ? openRoles.data.rows.find((x) => String(x.id ?? "") === j.key) : undefined;
                const city = row?.cells.city;
                const posted = row?.cells.posted;
                const langs = row?.cells.language;
                const host = j.postingUrl ? careersHost(j.postingUrl) : null;
                return (
                  <li key={j.key} className={styles.job}>
                    <span className={styles.jobText}>
                      <strong>{j.label}</strong>
                      <small>
                        {[city, posted && `posted ${String(posted)}`].filter(Boolean).join(" · ")}
                        {Array.isArray(langs) &&
                          langs.map((l) => (
                            <Tag key={l} tone="ink" className={styles.inlineTag}>
                              {l}
                            </Tag>
                          ))}
                      </small>
                    </span>
                    {j.postingUrl && host && (
                      <a href={j.postingUrl} target="_blank" rel="noopener noreferrer" className={styles.ext}>
                        View on {c.name} careers
                        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M3 1h6v6M9 1 1 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                        <span className="visually-hidden"> (opens {host} in a new tab)</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Box>
    </div>
  );
}

function Signals({ c, evidence }: { c: CompanyProfile; evidence: Evidence[] }) {
  const ie = c.indian_educated;
  return (
    <section className={styles.signalsCol} aria-labelledby="signals-title">
      <h2 id="signals-title" className={styles.rowTitle}>
        Indian-friendly signals
      </h2>
      <div className={styles.box}>
        {(c.visa_signals ?? []).length > 0 ? (
          <ul className={styles.signals}>
            {c.visa_signals!.map((s) => (
              <li key={s.label} className={styles.signal}>
                <Scope wide />
                <span>
                  <strong>{s.label}</strong>
                  {s.evidence_id && <EvidenceKey label={s.evidence_id} evidence={evidence.filter((e) => e.id === s.evidence_id)} />}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.small}>No visa signals found yet. Unknown is not the same as no.</p>
        )}
        {ie?.count && (
          <div className={styles.subBlock}>
            <h4 className={styles.subhead}>
              Indian-educated people here <span className={styles.keyInline}>n = {fmtInt(ie.count.n)}</span>
            </h4>
            <dl className={styles.ieGrid}>
              {ie.recent_24m != null && (
                <div>
                  <dt>Joined in 24 months</dt>
                  <dd>{fmtInt(ie.recent_24m)}</dd>
                </div>
              )}
              {ie.senior_share && (
                <div>
                  <dt>Reached senior or above</dt>
                  <dd>{ie.senior_share.display}</dd>
                </div>
              )}
              {ie.median_tenure_years != null && (
                <div>
                  <dt>Median stay</dt>
                  <dd>{ie.median_tenure_years} yrs</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- page ---------- */

export function CompanyView({ token, result }: { token: DrillToken; result: DrillResultFull }) {
  const c = result.company!;
  const { goals } = useProfile();
  const example = isExample(result.evidence);
  const path = result.path?.length ? result.path : token.path;
  const ev = result.evidence ?? [];
  const pl = c.people_like_you ?? result.count;
  const n = pl?.k ?? result.people_total ?? 0;
  const programs = sectionById(result, "programs");
  const feeders = sectionById(result, "feeder_employers");
  const degrees = sectionById(result, "degree_countries");
  const routes = sectionById(result, "entry_routes");
  const joined = sectionById(result, "joined_by_year");
  const openRoles = sectionById(result, "open_roles");
  const offices = c.offices ?? [];
  const parentLabel = path.length > 1 ? path[path.length - 2].label : null;
  const up = path.length > 1 ? tokenAtLevel({ ...token, path }, path.length - 1) : null;
  const officeTotal = offices.reduce((a, o) => a + (o.people_like_you ?? 0), 0);
  const conv = c.internship_conversion as Count | null | undefined;

  return (
    <div className={styles.page}>
      <DrillHeader
        token={token}
        context={result.context}
        path={path}
        aside={
          <span className={styles.legendTop}>
            <Scope label="People numbers use your filters" />
            <Scope wide label="Company facts are company-wide" />
          </span>
        }
      />

      <div className={styles.top}>
        <div className={styles.mark}>
          <CompanyMark name={c.name} shape="square" pitch={8} />
        </div>
        <div className={styles.topText}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{c.name}</h1>
            {example && <ExampleBadge force />}
            <p className={styles.tagline}>Where people like you joined, how they got in, and who is hiring now.</p>
          </div>
          <Facts c={c} evidence={ev} date={result.data_date} />
        </div>
      </div>

      <div className={styles.kpis}>
        {pl && <Kpi value={pl.k} unit={`of ${fmtInt(pl.n)}`} label="People like you here" sub={pl.display} evidence={ev} />}
        {c.indian_educated?.count && (
          <Kpi value={c.indian_educated.count.k} label="Indian-educated hires" sub={`${fmtInt(c.indian_educated.recent_24m ?? 0)} joined in 24 months`} wide evidence={ev} />
        )}
        {conv && <Kpi value={conv.k} unit={`of ${conv.n}`} label="Internship → full-time" sub={conv.display} evidence={ev} />}
        {c.promotion?.median_years_to_first_promotion != null && (
          <Kpi value={c.promotion.median_years_to_first_promotion.toFixed(1)} unit="yrs" label="Years to first promotion" sub={`median · n = ${c.promotion.n ?? n}`} />
        )}
        {c.retention?.median_tenure_years != null && (
          <Kpi value={c.retention.median_tenure_years.toFixed(1)} unit="yrs" label="Time people stay" sub={`median tenure · n = ${n}`} />
        )}
        {c.hiring?.open_postings_90d != null && (
          <Kpi
            value={c.hiring.open_postings_90d}
            unit={pct(c.hiring.change_vs_prev) ?? undefined}
            label="Open postings, 90 days"
            sub={c.hiring.change_vs_prev != null ? `${pct(c.hiring.change_vs_prev)} vs prior 90 days` : "job search"}
            wide
            evidence={ev}
          />
        )}
      </div>

      {(programs || feeders || degrees) && (
        <section className={styles.group} aria-labelledby="came-from">
          <div className={styles.groupHead}>
            <h2 id="came-from" className={styles.rowTitle}>
              Where they came from
            </h2>
            <p className={styles.groupNote}>
              the {n} {result.count_label ?? "people like you"} at {c.name}, before they joined
            </p>
          </div>
          <div className={styles.cols3}>
            {programs && (
              <Box title={programs.title} scope="filters" keyText={`N = ${n}`}>
                <PeopleList rows={rowsOf(programs)} label={programs.title} youTag="Your college" />
              </Box>
            )}
            {feeders && (
              <Box title={feeders.title} scope="filters" keyText={`N = ${n}`}>
                <PeopleList rows={rowsOf(feeders)} label={feeders.title} youTag="Like you" />
              </Box>
            )}
            {degrees && (
              <Box title={degrees.title} scope="filters" keyText={`N = ${n}`}>
                <DegreeWaffle section={degrees} />
              </Box>
            )}
          </div>
        </section>
      )}

      <div className={styles.workRow}>
        {offices.length > 0 && (
          <div className={styles.workTiles}>
            <TileRow title="Where they work" note={`${c.name} offices with people like you · N = ${officeTotal || n}`} dim>
              {offices.map((o, i) => {
                const tok: DrillToken = { ...token, path: [...path, { dimension: "city", value: o.city, label: o.city }] };
                const k = o.people_like_you ?? 0;
                return (
                  <PosterTile
                    key={`${o.city}-${o.country}`}
                    title={o.city}
                    art={<PlaceArt place={o.city} shape={i === 0 ? "wide" : "portrait"} />}
                    count={k}
                    variant={i === 0 ? "wide" : "card"}
                    expanded={i === 0}
                    badge={i === 0 ? "Most people like you" : undefined}
                    countLine={i === 0 ? `at least ${k} of ${n}` : undefined}
                    note={k < 5 ? "Counts only" : undefined}
                    drill={k > 0 ? tok : null}
                    drillLabel={`See the ${k} people`}
                  />
                );
              })}
            </TileRow>
          </div>
        )}
        <Signals c={c} evidence={ev} />
      </div>

      {(routes || joined) && (
        <section className={styles.group} aria-labelledby="got-in">
          <div className={styles.groupHead}>
            <h2 id="got-in" className={styles.rowTitle}>
              How people like you got in
            </h2>
            <p className={styles.groupNote}>entry routes into {c.name} and when people joined</p>
          </div>
          <div className={styles.cols2}>
            {routes?.kind === "route_list" && <EntryRoutes section={routes} n={n} />}
            {joined?.kind === "timeseries" && <JoinedByYear data={joined.data} n={n} name={c.name} />}
          </div>
        </section>
      )}

      {c.hiring && (
        <section className={styles.group} aria-labelledby="hiring">
          <div className={styles.groupHead}>
            <h2 id="hiring" className={styles.rowTitle}>
              Hiring right now
            </h2>
            <p className={styles.groupNote}>
              <Scope wide /> company-wide · all {c.name} postings in the last 90 days
            </p>
          </div>
          <Hiring c={c} openRoles={openRoles} targetRole={goals?.target_roles?.[0]} evidence={ev} />
        </section>
      )}

      <PeopleRow
        title={`People like you at ${c.name}`}
        people={result.people}
        total={result.people_total ?? n}
        note={result.people_note}
        blockedReason={result.listing_blocked_reason}
        upHref={up ? drillHref(up) : undefined}
        upLabel={parentLabel ? `See everyone in ${parentLabel}` : undefined}
      />

      {result.warnings && result.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <DrillFooter steps={result.next_steps} place={c.name} />
    </div>
  );
}
