"use client";
// /people/<id>?from=<drill token>: one anonymous career path, with the breadcrumb and filter
// chips of the drill it was opened from, and prev/next through that drill's people.
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import type { PersonCard, PersonDetailFull, PersonStep } from "@/lib/drill-types";
import { useProfile } from "@/components/shell/ProfileContext";
import { homeCountry, stageOf, stageToken } from "@/components/art/stages";
import { CellDigits } from "@/components/data/CellDigits";
import { GridFill } from "@/components/data/GridFill";
import { PersonTile } from "@/components/tiles/PersonTile";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { Chevron } from "@/components/ui/Chevron";
import { IS_MOCK, drillMockActive } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { DrillHeader } from "./DrillHeader";
import { CareerTimeline } from "./CareerTimeline";
import { ComparePanel } from "./ComparePanel";
import { decodeToken, drillHref, personHref } from "./token";
import { useDrillResult, usePerson } from "./useDrillResult";
import styles from "./Person.module.css";

const yrs = (y?: number | null) => (y == null ? "" : `${Number.isInteger(y) ? y : y.toFixed(1)} yr${y === 1 ? "" : "s"}`);

function StepList({ steps, highlight }: { steps: PersonStep[]; highlight: number }) {
  const home = homeCountry(steps);
  return (
    <section className={styles.panel} aria-labelledby="steps-title">
      <header className={styles.panelHead}>
        <h2 id="steps-title" className={styles.panelTitle}>
          Every step
        </h2>
        <span className={styles.key}>Years only · rounded to 0.5 yr</span>
      </header>
      <ol className={styles.steps}>
        {steps.map((s, i) => {
          const st = stageOf(s, home);
          return (
            <li key={`${s.org}-${i}`} className={[styles.step, i === highlight && styles.stepHi].filter(Boolean).join(" ")}>
              <i className={[styles.swatch, st === "intern" && styles.swatchHollow].filter(Boolean).join(" ")} style={{ ["--c" as string]: stageToken(st) } as CSSProperties} aria-hidden="true" />
              <span className={styles.stepText}>
                <strong>
                  {s.org}
                  {s.title ? ` — ${s.title}` : ""}
                </strong>
                <small>{[s.city, s.country].filter(Boolean).join(", ")}</small>
              </span>
              <span className={styles.stepYears}>
                <strong>
                  {s.start_year ?? "?"}–{s.end_year ?? "now"}
                </strong>
                <small>{yrs(s.years)}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SameRoute({ person }: { person: PersonDetailFull }) {
  const stat = person.route_stats?.[0];
  const rest = person.route_stats?.slice(1) ?? [];
  const tiles: PersonCard[] = person.same_route ?? [];
  if (!stat && !tiles.length) return null;
  const k = stat?.count.k ?? tiles.length;
  const n = stat?.count.n;
  return (
    <section className={styles.panel} id="same-route" aria-labelledby="same-title">
      <header className={styles.panelHead}>
        <h2 id="same-title" className={styles.panelTitle}>
          Same route, {k} {k === 1 ? "person" : "people"} like you
        </h2>
        {n != null && <span className={styles.key}>N = {n} in this slice{n < 10 ? " · small group" : ""}</span>}
      </header>
      <div className={styles.sameBody}>
        <div className={styles.sameStats}>
          {stat && (
            <div className={styles.sameStat}>
              <CellDigits value={k} pitch={5} tone="ink" />
              <p>
                at least <strong>{stat.count.display.replace(/^at least /, "")}</strong> {stat.label}.
                {stat.count.n < 10 && <strong className={styles.hint}> Under 10 people: read as a hint.</strong>}
              </p>
            </div>
          )}
          {person.route_typical_years != null && (
            <div className={styles.sameStat}>
              <CellDigits value={person.route_typical_years.toFixed(1)} pitch={4} tone="ink" label={`about ${person.route_typical_years} years`} />
              <p>years from the first step abroad to a full-time job, typical</p>
            </div>
          )}
          {rest.map((r) => (
            <div key={r.label} className={styles.sameStat}>
              <CellDigits value={r.count.k} pitch={4} tone="ink" />
              <p>
                of the {r.count.n} {r.label}
              </p>
            </div>
          ))}
        </div>
        {tiles.length > 0 && (
          <ul className={styles.sameTiles}>
            {tiles.slice(0, 3).map((p) => (
              <li key={p.id}>
                <PersonTile person={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Skills({ person, mine }: { person: PersonDetailFull; mine: string[] }) {
  const items = person.route_skills ?? (person.skills ?? []).map((term) => ({ term, count: 0, n: 0 }));
  if (!items.length) return null;
  const has = (t: string) => mine.some((m) => m.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(m.toLowerCase()));
  const n = items[0]?.n || null;
  return (
    <section className={styles.panel} aria-labelledby="skills-title">
      <header className={styles.panelHead}>
        <h2 id="skills-title" className={styles.panelTitle}>
          Skills on this route
        </h2>
        {n ? <span className={styles.key}>N = {n}</span> : null}
      </header>
      <p className={styles.tickKey}>
        <span>
          <i className={[styles.tick, styles.ticked].join(" ")} aria-hidden="true" /> On your profile
        </span>
        <span>
          <i className={styles.tick} aria-hidden="true" /> Not yet
        </span>
      </p>
      <ul className={styles.skills}>
        {items.map((s) => {
          const yes = has(s.term);
          return (
            <li key={s.term} className={styles.skill}>
              <i className={[styles.tick, yes && styles.ticked].filter(Boolean).join(" ")} aria-hidden="true" />
              <span className={styles.skillName}>
                {s.term}
                <span className="visually-hidden">{yes ? " (on your profile)" : " (not on your profile yet)"}</span>
              </span>
              {s.n > 0 && (
                <>
                  <span className={styles.skillCells} aria-hidden="true">
                    {Array.from({ length: s.n }, (_, i) => (
                      <i key={i} className={i < s.count ? styles.on : undefined} />
                    ))}
                  </span>
                  <span className={styles.skillNum}>
                    {s.count}
                    <span className="visually-hidden"> of {s.n}</span>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PersonView() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ? decodeURIComponent(rawId) : null;
  const sp = useSearchParams();
  const from = decodeToken(sp.get("from"));
  const { profileId, profile } = useProfile();
  const { person, error, loading, retry } = usePerson(profileId, id);
  const origin = useDrillResult(profileId, from);
  const people = origin.result?.people ?? [];
  const idx = id ? people.findIndex((p) => p.id === id) : -1;
  const prev = idx > 0 ? people[idx - 1] : null;
  const next = idx >= 0 && idx < people.length - 1 ? people[idx + 1] : null;
  const where = from?.path[from.path.length - 1]?.label;
  const example = IS_MOCK || drillMockActive();

  useEffect(() => {
    if (person) document.title = `${person.headline} · AfterDegree`;
  }, [person]);

  const nav = from ? (
    <span className={styles.prevNext}>
      {idx >= 0 && (
        <span className={styles.position}>
          Path {idx + 1} of {people.length}
          {where ? ` in ${where}` : ""}
        </span>
      )}
      {prev ? (
        <Link href={personHref(prev.id, from)} className={styles.navBtn} aria-label={`Previous path: ${prev.headline}`}>
          <Chevron dir="left" size={14} />
        </Link>
      ) : (
        <span className={[styles.navBtn, styles.navOff].join(" ")} aria-hidden="true">
          <Chevron dir="left" size={14} />
        </span>
      )}
      {next ? (
        <Link href={personHref(next.id, from)} className={styles.navBtn} aria-label={`Next path: ${next.headline}`}>
          <Chevron dir="right" size={14} />
        </Link>
      ) : (
        <span className={[styles.navBtn, styles.navOff].join(" ")} aria-hidden="true">
          <Chevron dir="right" size={14} />
        </span>
      )}
    </span>
  ) : null;

  const header = from ? (
    <DrillHeader
      token={from}
      context={origin.result?.context}
      current={person?.headline ?? "Career path"}
      lead={example ? <ExampleBadge force /> : undefined}
      aside={nav}
    />
  ) : (
    <nav aria-label="Where you are" className={styles.plainCrumb}>
      <Link href="/home">Home</Link> <Chevron dir="right" size={12} /> <strong>{person?.headline ?? "Career path"}</strong>
    </nav>
  );

  if (!person) {
    return (
      <div className={styles.page}>
        {header}
        {error ? (
          <div className={styles.narrow}>
            <InlineError
              title="We couldn't open this career path"
              message={error.message}
              hint={error.hint ?? "Paths are kept for 7 days. Open the group again to see current paths."}
              onRetry={retry}
            />
            {from && (
              <p className={styles.backLink}>
                <Link href={drillHref(from)}>Back to {where ?? "the group"}</Link>
              </p>
            )}
          </div>
        ) : (
          <div className={styles.loading} role="status" aria-live="polite">
            <GridFill done={loading ? 1 : 2} total={2} cells={48} size={14} onOrange />
            <p>Drawing this career path…</p>
          </div>
        )}
      </div>
    );
  }

  const steps = [...person.steps].sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0) || (a.end_year ?? 9999) - (b.end_year ?? 9999));
  const home = homeCountry(steps);
  const highlight = steps.length - 1;
  const current = steps[highlight];
  const reasons = person.match_reasons ?? [];
  const tags = person.tags ?? [];
  const routeTag = tags.find((t) => t.includes("→"));
  const moveTag = tags.find((t) => /moved/i.test(t));
  const routeStages = steps.filter((s) => s.kind !== "education" || s.country !== home).map((s) => stageOf(s, home));
  const why = person.why ?? reasons.map((r) => ({ label: r, value: "", note: undefined as string | undefined }));
  const routeStat = person.route_stats?.[0];

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.top}>
        <div className={styles.topText}>
          <h1 className={styles.title}>{person.headline}</h1>
          <p className={styles.lede}>
            Anonymised career path · years only
            {reasons.length > 0 && <> · shown because this path matches yours: {reasons.map((r) => r.toLowerCase()).join(", ")}</>}
          </p>
          {(moveTag || routeTag) && (
            <ul className={styles.tags}>
              {moveTag && (
                <li className={styles.tag}>
                  <span className={styles.miniCells} aria-hidden="true">
                    <i style={{ ["--c" as string]: "var(--ad-ink)" } as CSSProperties} />
                    <i className={styles.miniHollow} />
                  </span>
                  {moveTag}
                </li>
              )}
              {routeTag && (
                <li className={styles.tag}>
                  <span className={styles.miniCells} aria-hidden="true">
                    {[...new Set(routeStages)].slice(0, 3).map((st) => (
                      <i key={st} style={{ ["--c" as string]: stageToken(st) } as CSSProperties} />
                    ))}
                  </span>
                  {routeTag}
                </li>
              )}
            </ul>
          )}
        </div>
        {why.length > 0 && (
          <aside className={styles.why} aria-labelledby="why-title">
            <h2 id="why-title" className={styles.whyTitle}>
              Why you&rsquo;re seeing this path
            </h2>
            <dl className={styles.whyList}>
              {why.map((w) => (
                <div key={w.label}>
                  <dt>{w.label}</dt>
                  <dd>
                    {w.value && <strong>{w.value}</strong>}
                    {w.note && <span> · {w.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {routeStat && (
              <p className={styles.keyLine}>
                {routeStat.count.k} of {routeStat.count.n} took this route
              </p>
            )}
          </aside>
        )}
      </div>

      <section className={styles.panel} aria-labelledby="timeline-title">
        <header className={styles.panelHead}>
          <h2 id="timeline-title" className={styles.panelTitle}>
            Career path, {steps[0]?.start_year ?? ""} to today
          </h2>
        </header>
        <CareerTimeline steps={steps} highlightIndex={highlight} />
      </section>

      <div className={styles.cols}>
        <StepList steps={steps} highlight={highlight} />
        <ComparePanel
          theirs={steps}
          profile={profile}
          company={current?.org && !/^a /.test(current.org) ? current.org : undefined}
          country={current?.country}
          sameRouteHref={person.same_route?.length || routeStat ? "#same-route" : undefined}
        />
      </div>

      <div className={styles.colsWide}>
        <SameRoute person={person} />
        <Skills person={person} mine={profile?.person.skills ?? []} />
      </div>

      <footer className={styles.foot}>
        <p>
          <strong>We never show names or profile links.</strong> Paths are anonymised to years only, and listed only when at least 5 people match.
        </p>
        <p>
          {example ? "Example data · " : ""}
          {person.data_date ? `as of ${formatDate(person.data_date)}` : ""}
        </p>
      </footer>
    </div>
  );
}
