"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useJob } from "@/hooks/useJob";
import { firstName, fmtInt, formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type { DistributionData, MatchLevel, RankedTableData, ResultEnvelope, Section, StatData } from "@/lib/types";
import { CohortWaffle } from "@/components/data/CohortWaffle";
import { Distribution } from "@/components/data/Distribution";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { GridNumber } from "@/components/data/GridNumber";
import { JobProgress } from "@/components/data/JobProgress";
import { Panel } from "@/components/data/Panel";
import { coverageOf, sectionEvidence } from "@/components/data/ResultView";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { Select } from "@/components/ui/Select";
import { useProfile } from "@/components/shell/ProfileContext";
import { IS_MOCK } from "@/lib/api";
import { aimText, backgroundLine } from "./profileLine";
import styles from "./HomeView.module.css";

type Params = { match: MatchLevel; exp_band?: [number, number] };

const MATCH_OPTIONS = [
  { value: "exact_school", label: "Same college and field" },
  { value: "school_tier", label: "Similar colleges, same field" },
  { value: "field_only", label: "Same field, any college" },
];
const BAND_OPTIONS = [
  { value: "1-3", label: "1 to 3 years of work" },
  { value: "0-1", label: "Under a year of work" },
  { value: "2-3", label: "2 to 3 years of work" },
  { value: "3-6", label: "3 to 6 years of work" },
  { value: "any", label: "Any amount of work" },
];

function find<K extends Section["kind"]>(r: ResultEnvelope | null, id: string, kind: K) {
  const s = r?.sections.find((x) => x.id === id && x.kind === kind) ?? r?.sections.find((x) => x.kind === kind);
  return s as Extract<Section, { kind: K }> | undefined;
}

/** Ranked-table rows (label + people) as distribution rows for the compact home panels. */
function tableAsDistribution(t: RankedTableData | undefined): DistributionData | null {
  if (!t) return null;
  const [labelCol, valueCol] = [t.columns[0]?.key, t.columns.find((c) => c.type === "int" || c.type === "count")?.key];
  if (!labelCol || !valueCol) return null;
  const items = t.rows.map((r) => {
    const v = r.cells[valueCol];
    const count = typeof v === "number" ? v : v && typeof v === "object" && "k" in v ? v.k : 0;
    return { label: String(r.cells[labelCol] ?? ""), count, remainder: r.rest, target: r.you };
  });
  return { n: t.n ?? items.reduce((s, i) => s + i.count, 0), items };
}

/** "People like you": the cohort drawn one cell per person, the answer set in grid numerals. */
export function HomeView() {
  const { profile, goals, profileId, university, loading: profileLoading, error: profileError, refresh } = useProfile();
  const job = useJob();
  const [params, setParams] = useState<Params>({ match: "exact_school" });
  const [adjusting, setAdjusting] = useState(false);
  const started = useRef<string | null>(null);

  const run = useCallback(
    (p: Params) => {
      if (!profileId) return;
      const body: Record<string, unknown> = { ...p };
      if (university && goals) Object.assign(body, { institution: goals.institution, programs: goals.programs });
      void job.run("people_like_me", profileId, body);
    },
    // job.run is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileId, university, goals],
  );

  useEffect(() => {
    if (!profileId || !goals || started.current === profileId) return;
    started.current = profileId;
    run(params);
  }, [profileId, goals, params, run]);

  const apply = (p: Params) => {
    setParams(p);
    setAdjusting(false);
    run(p);
  };

  const onAdjust = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const band = String(fd.get("band"));
    const p: Params = { match: String(fd.get("match")) as MatchLevel };
    if (band !== "any") p.exp_band = band.split("-").map(Number) as [number, number];
    if (band === "1-3") delete p.exp_band;
    apply(p);
  };

  if (profileError) {
    return (
      <div className={styles.home}>
        <div className={styles.errorWrap}>
          <InlineError title="We couldn't load your profile" message={profileError.message} hint={profileError.hint} onRetry={refresh} />
        </div>
      </div>
    );
  }

  const r = job.result;
  const busy = job.phase !== "done" && job.phase !== "error";
  const moved = find(r, "moved_abroad", "stat");
  const size = find(r, "cohort_size", "stat");
  const countries = r?.sections.find((s) => s.id === "countries" && s.kind === "distribution") as Extract<Section, { kind: "distribution" }> | undefined;
  const roles = r?.sections.find((s) => s.id === "roles" && s.kind === "ranked_table") as Extract<Section, { kind: "ranked_table" }> | undefined;
  const employers = r?.sections.find((s) => s.id === "employers_target" && s.kind === "ranked_table") as Extract<Section, { kind: "ranked_table" }> | undefined;
  const degrees = r?.sections.find((s) => s.id === "further_degrees" && s.kind === "distribution") as Extract<Section, { kind: "distribution" }> | undefined;
  const studied = r?.sections.find((s) => s.id === "degree_countries" && s.kind === "distribution") as Extract<Section, { kind: "distribution" }> | undefined;

  const n = r?.cohort?.n_visible ?? size?.data.value ?? 0;
  const coverage = r ? coverageOf(r) : null;
  const thin = !!r && (n < 10 || r.confidence === "low");
  const next = r?.next_steps[0];
  const who = university ? "your graduates" : "people like you";
  const name = profile ? firstName(profile.person.name) : "";
  const aim = aimText(goals);
  const nAbroad = countries ? countries.data.items.filter((i) => !i.remainder).reduce((s, i) => s + i.count, 0) : 0;
  const home = countries?.data.items.find((i) => i.remainder);

  return (
    <div className={styles.home}>
      {/* ---- greeting + cohort definition ---- */}
      <div className={styles.top}>
        <div className={styles.greeting}>
          <div className={styles.tagRow}>
            <ExampleBadge />
            {IS_MOCK && <span>{university ? "Your graduates" : "People like you"} · illustrative numbers, not live results</span>}
          </div>
          <h1 className={styles.title}>{name ? `Welcome back, ${name}.` : "Welcome back."}</h1>
          {profile && (
            <p className={styles.who}>
              {university ? (
                <>
                  {profile.derived.current_title} · following <b>{goals?.programs.join(", ") || "all programs"}</b>
                </>
              ) : (
                <>
                  {backgroundLine(profile)}
                  {aim && (
                    <>
                      {" · "}
                      <b>aiming: {aim}</b>
                    </>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        <div className={styles.cohortCard}>
          <EvidenceKey
            label={r ? `${university ? "Your graduates" : "Your cohort"} · ${fmtInt(n)} visible profiles` : `${university ? "Your graduates" : "Your cohort"} · counting`}
            n={r ? n : undefined}
            coverage={coverage}
            date={r?.data_date}
            evidence={r?.evidence}
            note={r?.coverage_note}
          />
          <p className={styles.cohortDef}>{r?.cohort?.definition ?? (busy ? "Working out who has your background…" : "We'll define your cohort from your profile.")}</p>
          {!university && (
            <button type="button" className={styles.adjust} aria-expanded={adjusting} aria-controls="adjust-cohort" onClick={() => setAdjusting((a) => !a)}>
              {adjusting ? "Keep it as it is" : "Adjust who counts as “like you”"}
            </button>
          )}
          {adjusting && (
            <form id="adjust-cohort" className={styles.adjustForm} onSubmit={onAdjust}>
              <Select name="match" label="College" options={MATCH_OPTIONS} defaultValue={params.match} />
              <Select name="band" label="Experience" options={BAND_OPTIONS} defaultValue={params.exp_band ? params.exp_band.join("-") : "1-3"} />
              <div className={styles.adjustActions}>
                <Button type="submit" size="sm">
                  Recount
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ---- error ---- */}
      {job.phase === "error" && job.error && (
        <div className={styles.errorWrap}>
          <InlineError title="We couldn't count your cohort just now" message={job.error.message} hint={job.error.hint} onRetry={() => run(params)} />
        </div>
      )}

      {/* ---- loading: the grid fills as the job advances ---- */}
      {(busy || profileLoading) && job.phase !== "error" && (
        <>
          <div className={styles.loadingHero} aria-hidden="true">
            <p className={styles.least}>Counting {who}</p>
            <div className={styles.loadingNumber}>
              {Array.from({ length: 17 * 7 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
          </div>
          <Panel title={`Where ${who} are now`} className={styles.wafflePanel}>
            <JobProgress phase={job.phase === "idle" ? "starting" : job.phase} job={job.job} cells={240} size={8} />
          </Panel>
        </>
      )}

      {/* ---- thin cohort ---- */}
      {r && thin && (
        <div className={styles.thin}>
          <Panel title={`Only ${fmtInt(n)} ${n === 1 ? "person matches" : "people match"} so far`}>
            <div className={styles.thinBody}>
              <p>
                That isn&apos;t a verdict on your plans. It means few people with exactly this background have public profiles we can see, so any
                share would be guesswork. Widening who counts as like you gives a fairer picture; we&apos;ll always say what we widened.
              </p>
              {r.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <div className={styles.thinActions}>
                <Button onClick={() => apply({ match: "school_tier" })}>Include similar colleges</Button>
                <Button variant="secondary" onClick={() => apply({ match: params.match })}>
                  Use 1 to 3 years of work
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ---- result ---- */}
      {r && job.phase === "done" && (
        <>
          <div className={styles.hero}>
            {moved && <HeroCount data={moved.data} r={r} university={university} />}
            {!moved && size && <HeroCount data={size.data} r={r} university={university} />}
            {next && (
              <ButtonLink className={styles.cta} href={toolHref(next.tool, next.params)}>
                {next.label}
              </ButtonLink>
            )}
          </div>

          {countries && (
            <Panel
              className={styles.wafflePanel}
              title={countries.title}
              caption={countries.data.caption}
              evidence={<EvidenceKey label={`n = ${fmtInt(countries.data.n)} · by current country`} n={countries.data.n} coverage={coverage} date={r.data_date} evidence={sectionEvidence(countries, r.evidence)} note={r.coverage_note} />}
            >
              <CohortWaffle
                items={countries.data.items}
                n={countries.data.n}
                label={countries.title}
                filledLabel={`Abroad · ${fmtInt(nAbroad)}`}
                hollowLabel={home ? `${home.label} · ${fmtInt(home.count)}` : undefined}
              />
            </Panel>
          )}

          <div className={styles.three}>
            {roles && (
              <CompactPanel section={roles} r={r} keyLabel={`n = ${fmtInt(roles.data.n ?? 0)} ${roles.data.caption ?? ""}`.trim()} />
            )}
            {employers && <CompactPanel section={employers} r={r} keyLabel={`n = ${fmtInt(employers.data.n ?? 0)}`} />}
            {degrees && (
              <Panel
                title={degrees.title}
                evidence={<EvidenceKey label={`n = ${fmtInt(degrees.data.n)}`} n={degrees.data.n} date={r.data_date} evidence={sectionEvidence(degrees, r.evidence)} note={r.coverage_note} />}
              >
                <div className={styles.degrees}>
                  {degrees.data.items
                    .filter((i) => !i.remainder)
                    .slice(0, 3)
                    .map((i) => (
                      <div key={i.label} className={styles.degree}>
                        <b>{fmtInt(i.count)}</b>
                        <span>{i.label}</span>
                      </div>
                    ))}
                </div>
                {degrees.data.caption && <p className={styles.degreeNote}>{degrees.data.caption}</p>}
                {studied && studied.data.items.length > 0 && (
                  <p className={styles.studied}>
                    Studied in:{" "}
                    {studied.data.items.slice(0, 3).map((i, k) => (
                      <span key={i.label}>
                        {k > 0 && ", "}
                        <strong>{i.label}</strong> {fmtInt(i.count)}
                      </span>
                    ))}
                  </p>
                )}
              </Panel>
            )}
          </div>

          <p className={styles.foot}>
            <span>
              {r.coverage_note} Data as of {formatDate(r.data_date)}.
            </span>
            <EvidenceKey tone="ink" label="How we count" n={n} coverage={coverage} date={r.data_date} evidence={r.evidence} note={r.coverage_note} />
          </p>
        </>
      )}
    </div>
  );
}

function HeroCount({ data, r, university }: { data: StatData; r: ResultEnvelope; university: boolean }) {
  const lens = (t: string) => (university ? t.replace(/people like you/gi, "your graduates") : t);
  const c = data.count;
  const value = c ? c.k : (data.value ?? 0);
  const lower = !!c && c.share !== null;
  return (
    <>
      <div className={styles.leastRow}>
        <p className={styles.least}>{lower ? "At least" : c ? "Only" : "We can see"}</p>
        {c && (
          <EvidenceKey boxed label={`${fmtInt(c.k)} / ${fmtInt(c.n)}${coverageOf(r) != null ? ` · ${Math.round(coverageOf(r)! * 100)}% coverage` : ""}`} n={c.n} coverage={coverageOf(r)} date={r.data_date} evidence={r.evidence} note={r.coverage_note} />
        )}
      </div>
      <GridNumber className={styles.digits} value={value} cell={32} label={c ? c.display : fmtInt(value)} />
      <p className={styles.sentence}>
        {c ? `of ${fmtInt(c.n)} ${lens(data.label.replace(/^of\s+/i, ""))}.` : `${lens(data.label)}.`}
        {c && c.share === null && " Too few to compare."}
      </p>
    </>
  );
}

function CompactPanel({ section, r, keyLabel }: { section: Extract<Section, { kind: "ranked_table" }>; r: ResultEnvelope; keyLabel: string }) {
  const dist = tableAsDistribution(section.data);
  return (
    <Panel
      title={section.title}
      evidence={<EvidenceKey label={keyLabel} n={section.data.n} date={r.data_date} evidence={sectionEvidence(section, r.evidence)} note={r.coverage_note} />}
    >
      {dist && <Distribution data={dist} maxRows={5} compact />}
    </Panel>
  );
}
