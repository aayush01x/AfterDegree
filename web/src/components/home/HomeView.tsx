"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useJob } from "@/hooks/useJob";
import type { DrillToken } from "@/lib/drill-types";
import { firstName, fmtInt, formatDate } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type { DistributionItem, MatchLevel, RankedRow, ResultEnvelope, Section } from "@/lib/types";
import { CompanyMark } from "@/components/art/CompanyMark";
import { PlaceArt } from "@/components/art/PlaceArt";
import { CellDigits } from "@/components/data/CellDigits";
import { drillOf } from "@/components/data/Drillable";
import { EmptyState } from "@/components/data/EmptyState";
import { EvidenceKey, evidenceText } from "@/components/data/EvidenceKey";
import { GridNumber } from "@/components/data/GridNumber";
import { JobProgress } from "@/components/data/JobProgress";
import { PersonStrip } from "@/components/data/PersonStrip";
import { coverageOf } from "@/components/data/ResultView";
import { LinkTile } from "@/components/tiles/LinkTile";
import { PosterTile } from "@/components/tiles/PosterTile";
import { RouteTile } from "@/components/tiles/RouteTile";
import { TileRow } from "@/components/tiles/TileRow";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { Select } from "@/components/ui/Select";
import { useProfile } from "@/components/shell/ProfileContext";
import { useDrill } from "@/components/drill/useDrill";
import { aimText, backgroundLine } from "./profileLine";
import styles from "./HomeView.module.css";

type Params = { match: MatchLevel; exp_band?: [number, number] };
type Of<K extends Section["kind"]> = Extract<Section, { kind: K }>;

const MATCH_OPTIONS = [
  { value: "exact_school", label: "Same college and field" },
  { value: "school_tier", label: "Similar colleges, same field" },
  { value: "field_only", label: "Same field, any college" },
];
const BAND_OPTIONS = [
  { value: "any", label: "Any amount of work" },
  { value: "0-1", label: "Under a year of work" },
  { value: "1-3", label: "1 to 3 years of work" },
  { value: "3-6", label: "3 to 6 years of work" },
];
const OTHER = /^(other|others|other countries|elsewhere)$/i;

function sec<K extends Section["kind"]>(r: ResultEnvelope | null, id: string, kind: K): Of<K> | undefined {
  return r?.sections.find((s) => s.id === id && s.kind === kind) as Of<K> | undefined;
}

const rowLabel = (row: RankedRow, key: string) => String(row.cells[key] ?? "");
const rowCount = (row: RankedRow) => {
  const v = row.cells.people;
  return typeof v === "number" ? v : (row.count?.k ?? 0);
};
type Noted = { note?: string | null; sample_n?: number | null };

/** "People like you": the cohort drawn one cell per person, then rows of destinations, companies and routes. */
export function HomeView() {
  const { profile, goals, profileId, university, loading: profileLoading, error: profileError, refresh } = useProfile();
  const job = useJob();
  const [params, setParams] = useState<Params>({ match: "exact_school" });
  const [adjusting, setAdjusting] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
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
    setFocus(null);
    run(p);
  };

  const onAdjust = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const band = String(fd.get("band"));
    const p: Params = { match: String(fd.get("match")) as MatchLevel };
    if (band !== "any") p.exp_band = band.split("-").map(Number) as [number, number];
    apply(p);
  };

  if (profileError) {
    return (
      <div className={styles.home}>
        <div className={styles.pad}>
          <InlineError title="We couldn't load your profile" message={profileError.message} hint={profileError.hint} onRetry={refresh} />
        </div>
      </div>
    );
  }

  const r = job.phase === "done" ? job.result : null;
  const busy = !r && job.phase !== "error";
  const moved = sec(r, "moved_abroad", "stat");
  const size = sec(r, "cohort_size", "stat");
  const countries = sec(r, "countries", "distribution");
  const roles = sec(r, "roles", "ranked_table");
  const employers = sec(r, "employers_target", "ranked_table");
  const studied = sec(r, "degree_countries", "distribution");

  const n = r?.cohort?.n_visible ?? size?.data.value ?? 0;
  const coverage = r ? coverageOf(r) : null;
  const thin = !!r && (n < 10 || r.confidence === "low");
  const next = r?.next_steps[0];
  const who = university ? "your graduates" : "people like you";
  const Who = university ? "Your graduates" : "People like you";
  const name = profile ? firstName(profile.person.name) : "";
  const aim = aimText(goals);
  const lens = (t: string) => (university ? t.replace(/people like you/gi, "your graduates") : t);

  const items: DistributionItem[] = (countries?.data.items ?? []).filter((i) => i.count > 0);
  const target = university ? undefined : items.find((i) => i.target);
  const abroad = items.filter((i) => !i.remainder);
  const focused = items.find((i) => i.label === focus) ?? target ?? abroad[0];
  const country = target?.label ?? goals?.target_countries[0];

  const empRows = (employers?.data.rows ?? []).filter((x) => !x.rest);
  const empNote = (employers?.data as Noted | undefined)?.note;
  const roleRows = (roles?.data.rows ?? []).filter((x) => !x.rest);
  const studiedIn = (label: string) => studied?.data.items.find((i) => i.label === label && !i.remainder);
  const sampleN = (countries?.data as Noted | undefined)?.sample_n;
  const ug = profile?.person.education.find((e) => /b\.?tech|b\.?e\b|bachelor|bsc/i.test(e.degree));
  const ugShort = ug ? (/b\.?tech/i.test(ug.degree) ? "BTech" : /bachelor of engineering|b\.?e\b/i.test(ug.degree) ? "BE" : "Bachelor’s") : "Bachelor’s";
  const gps = r?.next_steps.find((s) => s.tool === "reverse_gps");
  const friendly = r?.next_steps.find((s) => s.tool === "indian_friendly");

  /* ---------------- hero ---------------- */
  const c = moved?.data.count;
  const heroValue = c ? c.k : (size?.data.value ?? 0);
  const least = c && c.share !== null ? "At least" : c ? "Only" : "We can see";

  return (
    <div className={styles.home}>
      <section className={styles.top} aria-label="Your cohort">
        <div className={styles.hero}>
          <div className={styles.head}>
            <div className={styles.h1row}>
              <h1 className={styles.h1}>{name ? `Welcome back, ${name}.` : "Welcome back."}</h1>
              <ExampleBadge />
            </div>
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

          <aside className={styles.cohort} aria-labelledby="cohort-h">
            <div className={styles.ch}>
              <h2 id="cohort-h">{university ? "Your graduates" : "Your cohort"}</h2>
              {r ? (
                <EvidenceKey label={evidenceText(n, coverage, r.data_date)} n={n} coverage={coverage} date={r.data_date} evidence={r.evidence} note={r.coverage_note} />
              ) : (
                <span className={styles.counting}>counting</span>
              )}
            </div>
            <p className={styles.def}>{r?.cohort?.definition ?? (busy ? "Working out who has your background…" : "We'll define your cohort from your profile.")}</p>
            {!university && (
              <button type="button" className={styles.adjust} aria-expanded={adjusting} aria-controls="adjust-cohort" onClick={() => setAdjusting((a) => !a)}>
                {adjusting ? "Keep it as it is" : "Adjust who counts as like you"}
              </button>
            )}
            {adjusting && (
              <form id="adjust-cohort" className={styles.adjustForm} onSubmit={onAdjust}>
                <Select name="match" label="College" options={MATCH_OPTIONS} defaultValue={params.match} />
                <Select name="band" label="Experience" options={BAND_OPTIONS} defaultValue={params.exp_band ? params.exp_band.join("-") : "any"} />
                <div className={styles.adjustActions}>
                  <Button type="submit" size="sm">
                    Recount
                  </Button>
                </div>
              </form>
            )}
          </aside>

          <div className={styles.num}>
            {r && !thin ? (
              <>
                <p className={styles.least}>{least}</p>
                <GridNumber value={heroValue} label={c ? c.display : fmtInt(heroValue)} className={styles.digits} />
              </>
            ) : (
              <LoadingNumber busy={busy || profileLoading} done={job.job?.progress.done ?? 0} total={job.job?.progress.total ?? 1} who={who} />
            )}
          </div>

          <div className={styles.say}>
            {r && !thin && (
              <>
                <p className={styles.sentence}>
                  {c ? `of ${fmtInt(c.n)} ${lens((moved?.data.label ?? "").replace(/^of\s+/i, ""))}.` : `${lens(size?.data.label ?? "visible profiles")}.`}
                  {c && c.share === null && " Too few to compare."}
                </p>
                {next && (
                  <ButtonLink size="lg" className={styles.cta} href={toolHref(next.tool, next.params)}>
                    {next.label}
                  </ButtonLink>
                )}
              </>
            )}
          </div>
        </div>

        {job.phase === "error" && job.error && (
          <div className={styles.block}>
            <InlineError title="We couldn't count your cohort just now" message={job.error.message} hint={job.error.hint} onRetry={() => run(params)} />
          </div>
        )}

        {busy && (
          <div className={[styles.block, styles.loadingStrip].join(" ")}>
            <JobProgress phase={job.phase === "idle" ? "starting" : job.phase} job={job.job} cells={160} size={10} />
          </div>
        )}

        {r && thin && (
          <EmptyState
            className={styles.block}
            title={`Only ${fmtInt(n)} ${n === 1 ? "person matches" : "people match"} so far`}
            actions={
              <>
                <Button onClick={() => apply({ match: "school_tier" })}>Include similar colleges</Button>
                <Button variant="secondary" onClick={() => apply({ match: "field_only" })}>
                  Same field, any college
                </Button>
              </>
            }
          >
            <p>
              That isn&apos;t a verdict on your plans. Few people with exactly this background have public profiles we can see, so any share would be
              guesswork. Widening who counts as like you gives a fairer picture; we&apos;ll always say what we widened.
            </p>
            {r.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </EmptyState>
        )}

        {r && !thin && countries && items.length > 0 && (
          <PersonStrip
            className={styles.block}
            items={items}
            n={countries.data.n}
            label={`${Who} by current country`}
            intro={`Each square is one ${university ? "graduate" : "person like you"}.`}
            keyLabel={`N = ${fmtInt(countries.data.n)} · by country${sampleN && sampleN < n ? ` · read from ${fmtInt(sampleN)} of ${fmtInt(n)}` : ""}`}
          />
        )}
      </section>

      {r && !thin && abroad.length > 0 && (
        <TileRow
          className={styles.bandRow}
          band
          dim
          title={university ? "Where your graduates went" : "Where people like you went"}
          note={`${items.length} ${items.length === 1 ? "group" : "destinations"} · every count is “at least”, of ${fmtInt(countries!.data.n)}`}
          label="Destinations"
        >
          {items.map((it) => {
            const on = it === focused;
            const tok = drillOf(it);
            const master = studiedIn(it.label);
            const isTarget = !!target && it === target;
            return (
              <PosterTile
                key={it.label}
                variant="poster"
                tone="band"
                title={it.label}
                art={<PlaceArt place={it.label} shape="portrait" />}
                expandedArt={<PlaceArt place={it.label} shape="wide" />}
                count={it.count}
                unit={it.count === 1 ? (university ? "graduate" : "person") : university ? "graduates" : "people"}
                expanded={on}
                badge={isTarget ? "Your target" : undefined}
                countLine={`at least ${fmtInt(it.count)} of ${fmtInt(countries!.data.n)} ${who}`}
                drill={tok}
                drillLabel={`See the ${fmtInt(it.count)} ${it.count === 1 ? "person" : "people"}`}
                onSelect={on ? undefined : () => setFocus(it.label)}
                details={
                  on ? (
                    <FocusDetails
                      employers={isTarget ? empRows : []}
                      employerNote={isTarget && !empRows.length ? empNote : null}
                      roles={OTHER.test(it.label) || it.remainder ? [] : roleRows}
                      master={master}
                      masterOf={studied?.data.n}
                      remainder={!!it.remainder}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </TileRow>
      )}

      {r && !thin && country && employers && (
        <TileRow
          title={university ? "Companies that hire your graduates" : "Companies that hire people like you"}
          note={`in ${country} · ${who} working there now`}
          label="Companies"
        >
          {empRows.map((row) => {
            const label = rowLabel(row, "employer");
            const k = rowCount(row);
            return (
              <PosterTile
                key={row.id ?? label}
                variant="card"
                title={label}
                art={<CompanyMark name={label} />}
                count={k}
                unit={k === 1 ? "person" : "people"}
                badge={row.you ? "Where you work" : undefined}
                drill={drillOf(row)}
              />
            );
          })}
          {!empRows.length && (
            <div className={["ad-dots", styles.noteTile].join(" ")} data-tile="">
              <div className={styles.noteCard}>
                <p className={styles.noteTitle}>No single employer stands out yet</p>
                <p>{empNote ?? `No employer in ${country} has 5 or more ${who} in the profiles we read, so none is listed.`}</p>
                {target && drillOf(target) && (
                  <DrillButton token={drillOf(target)!} label={target.label}>
                    See the {fmtInt(target.count)} in {target.label}
                  </DrillButton>
                )}
              </div>
            </div>
          )}
          <LinkTile question="Which of these sponsor visas?" label="Indian-Friendly Companies" href={toolHref("indian_friendly", friendly?.params ?? { country })} />
        </TileRow>
      )}

      {r && !thin && studied && studied.data.items.some((i) => !i.remainder && i.count > 0) && (
        <TileRow
          title={university ? "Routes your graduates took" : "Routes that fit you"}
          note={`from a ${ugShort}: where ${who} took a master’s, of ${fmtInt(studied.data.n)} who took one`}
          label="Routes"
        >
          {studied.data.items
            .filter((i) => !i.remainder && i.count > 0)
            .map((i, k) => {
              const steps = [ugShort, OTHER.test(i.label) ? "Master’s in another country" : `Master’s in ${i.label}`];
              return (
                <RouteTile
                  key={i.label}
                  title={steps.join(" → ")}
                  steps={[...steps, "Work"]}
                  people={i.count}
                  hue={((k % 4) + 1) as 1 | 2 | 3 | 4}
                  badge={i.target && !university ? "Fits you best" : undefined}
                  drill={drillOf(i)}
                />
              );
            })}
          {gps && <LinkTile question="Which steps led to the job?" label="Reverse Career GPS" href={toolHref(gps.tool, gps.params)} />}
        </TileRow>
      )}

      {r && (
        <footer className={styles.foot}>
          <p>
            {r.coverage_note} Data as of {formatDate(r.data_date)}.
          </p>
          <EvidenceKey tone="ink" label="How we count" n={n} coverage={coverage} date={r.data_date} evidence={r.evidence} note={r.coverage_note} />
        </footer>
      )}
    </div>
  );
}

function DrillButton({ token, label, children }: { token: DrillToken; label: string; children: ReactNode }) {
  const d = useDrill();
  if (!d.enabled) return null;
  return (
    <Button size="sm" variant="secondary" chevron onClick={() => d.open(token, label)}>
      {children}
    </Button>
  );
}

function FocusDetails({
  employers,
  employerNote,
  roles,
  master,
  masterOf,
  remainder,
}: {
  employers: RankedRow[];
  employerNote?: string | null;
  roles: RankedRow[];
  master?: DistributionItem;
  masterOf?: number;
  remainder: boolean;
}) {
  const hasCols = employers.length > 0 || roles.length > 0;
  return (
    <>
      {hasCols && (
        <div className={styles.fcols}>
          {employers.length > 0 && (
            <dl>
              <dt>Top employers</dt>
              {employers.slice(0, 3).map((e) => (
                <dd key={e.id ?? rowLabel(e, "employer")}>
                  <span>{rowLabel(e, "employer")}</span>
                  <CellDigits value={rowCount(e)} pitch={2} tone="current" />
                </dd>
              ))}
            </dl>
          )}
          {roles.length > 0 && (
            <dl>
              <dt>Roles abroad</dt>
              {roles.slice(0, employers.length ? 3 : 4).map((e) => (
                <dd key={e.id ?? rowLabel(e, "role")}>
                  <span>{rowLabel(e, "role")}</span>
                  <CellDigits value={rowCount(e)} pitch={2} tone="current" />
                </dd>
              ))}
            </dl>
          )}
        </div>
      )}
      {employerNote && <p className={styles.fnote}>No single employer has 5 or more people here yet, so none is named.</p>}
      {master && (
        <p className={styles.froute}>
          <b>Master’s here:</b> {fmtInt(master.count)}
          {masterOf ? ` of the ${fmtInt(masterOf)} who took one` : ""}
        </p>
      )}
      {remainder && <p className={styles.froute}>Still in India, or no current country abroad on their profile.</p>}
    </>
  );
}

/** While counting: the headline number's 17 x 7 grid fills with the job's progress. */
function LoadingNumber({ busy, done, total, who }: { busy: boolean; done: number; total: number; who: string }) {
  const cells = 17 * 7;
  const filled = busy ? Math.round((Math.min(done + 0.5, total) / Math.max(1, total)) * cells) : 0;
  return (
    <div className={styles.loading} aria-hidden="true">
      <p className={styles.least}>{busy ? `Counting ${who}` : " "}</p>
      <div className={styles.loadingGrid}>
        {Array.from({ length: cells }, (_, i) => (
          <i key={i} className={i < filled ? styles.full : undefined} />
        ))}
      </div>
    </div>
  );
}
