"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Headline, RunsResponse, RunSummary, SnapshotResponse, SnapshotTile } from "@/lib/home-types";
import { firstName, fmtInt, formatDate } from "@/lib/format";
import { mergedFor } from "@/lib/pages";
import { TOOLS, toolHref } from "@/lib/tools";
import type { Goals, StoredProfile, ToolId } from "@/lib/types";
import { CellDigits } from "@/components/data/CellDigits";
import { GridFill } from "@/components/data/GridFill";
import { TileRow } from "@/components/tiles/TileRow";
import { ButtonLink } from "@/components/ui/Button";
import { Chevron } from "@/components/ui/Chevron";
import { InlineError } from "@/components/ui/InlineError";
import { Tag } from "@/components/ui/Tag";
import { useProfile } from "@/components/shell/ProfileContext";
import { shortDegree } from "./profileLine";
import styles from "./HomeView.module.css";

/* ---------------- words ---------------- */

const THE = /^(united states|united kingdom|netherlands|united arab emirates|czech republic|philippines)$/i;
const placeName = (p: string) => (THE.test(p) ? `the ${p}` : p);

function compactSchool(s: string | null | undefined): string {
  if (!s) return "";
  const m = /^(Indian Institute of Technology|National Institute of Technology|Indian Institute of Information Technology|Birla Institute of Technology and Science)[,\s-]*(.*)$/i.exec(s.trim());
  if (m) {
    const abbr = /information/i.test(m[1]) ? "IIIT" : /national/i.test(m[1]) ? "NIT" : /birla/i.test(m[1]) ? "BITS" : "IIT";
    return `${abbr} ${m[2]}`.trim();
  }
  return s.replace(/^Vellore Institute of Technology,?\s*/i, "VIT ").replace(/\s+/g, " ").trim();
}

/** "BTech Electrical Engineering, IIT Kanpur ’27" */
function fromLine(p: StoredProfile): string {
  const d = p.derived;
  const ed = p.person.education.find((e) => e.school === d.undergrad_school) ?? p.person.education[0];
  const degree = shortDegree(ed?.degree) || "Graduate";
  const field = d.undergrad_field ?? ed?.field ?? "";
  const school = compactSchool(d.undergrad_school ?? ed?.school);
  const yr = d.undergrad_end_year ? ` ’${String(d.undergrad_end_year).slice(2)}` : "";
  return `${degree}${field ? ` ${field}` : ""}${school ? `, ${school}` : ""}${yr}`;
}

/** "Software Engineer in the United States" (or what's missing). */
function toLine(g: Goals | null): string {
  if (!g) return "your next step";
  const role = g.target_roles[0];
  const place = g.target_cities[0] ?? g.target_countries[0];
  const where = place ? ` in ${placeName(place)}` : "";
  switch (g.intent) {
    case "masters_abroad":
      return `Master’s, then ${role ?? "a job"}${where}`;
    case "switch_role":
      return `Switch to ${role ?? "a new role"}${where}`;
    case "grow_in_place":
      return `Grow as ${role ?? "what you do"}${where}`;
    default:
      return `${role ?? "A job"}${where}`;
  }
}

function ago(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} ${d === 1 ? "day" : "days"} ago` : formatDate(iso);
}

const known = (tool: string): tool is ToolId => TOOLS.some((t) => t.id === tool);
const toolName = (id: ToolId) => {
  const m = mergedFor(id);
  return m ? `${m.page.short} · ${m.tab.label}` : TOOLS.find((t) => t.id === id)!.short;
};

/** Params that point a tool at the user's goal, for tools not checked yet. */
function goalParams(tool: ToolId, g: Goals | null, university: boolean): Record<string, unknown> {
  const role = g?.target_roles[0];
  const country = g?.target_countries[0];
  const city = g?.target_cities[0];
  switch (tool) {
    case "people_like_me":
      return university && g?.institution ? { institution: g.institution } : { match: "exact_school" };
    case "conversion_map":
      return { scope: { country, role } };
    case "internship_chances":
    case "indian_friendly":
      return { country, role, city };
    default:
      return { role, city, country };
  }
}

const NEEDS_ROLE: ToolId[] = ["reverse_gps", "routes_to_position", "job_postings", "market_saturation"];
const TILE_ORDER: ToolId[] = [
  "people_like_me",
  "reverse_gps",
  "routes_to_position",
  "internship_chances",
  "conversion_map",
  "indian_friendly",
  "job_postings",
  "market_saturation",
];

interface Step {
  tools: ToolId[];
  title: string;
  titleUni: string;
  why: string;
  whyUni: string;
}
const STEPS: Step[] = [
  {
    tools: ["people_like_me"],
    title: "See where people like you went",
    titleUni: "See where your graduates went",
    why: "Countries, roles and employers of people with your background.",
    whyUni: "Countries, roles and employers of your graduates.",
  },
  {
    tools: ["reverse_gps", "routes_to_position"],
    title: "Pick a route",
    titleUni: "See the routes they took",
    why: "The steps people took to reach your goal, from where you are today.",
    whyUni: "The steps your graduates took into a position.",
  },
  {
    tools: ["internship_chances", "conversion_map"],
    title: "Check your internship odds",
    titleUni: "Check internship conversion",
    why: "How often internships turned into full-time jobs, and where.",
    whyUni: "How often your graduates’ internships became full-time jobs.",
  },
  {
    tools: ["indian_friendly"],
    title: "Shortlist employers",
    titleUni: "Find employers that hire your graduates",
    why: "Employers abroad with a record of hiring Indian-educated people.",
    whyUni: "Employers abroad with a record of hiring Indian-educated graduates.",
  },
  {
    tools: ["job_postings"],
    title: "Read real postings",
    titleUni: "Read real postings",
    why: "What current postings for your role ask for: skills, languages, visas.",
    whyUni: "What postings in your graduates’ target markets ask for.",
  },
  {
    tools: ["market_saturation"],
    title: "Check the competition",
    titleUni: "Check the competition",
    why: "How many people like you are entering against the openings.",
    whyUni: "How many graduates like yours are entering against the openings.",
  },
];

/* ---------------- view ---------------- */

/** "Your plan": the goal, a few fresh numbers, the headline of every check and the path. */
export function HomeView() {
  const { profile, goals, profileId, university, error: profileError, refresh } = useProfile();
  const [runs, setRuns] = useState<RunsResponse | null>(null);
  const [runsError, setRunsError] = useState<ApiError | null>(null);
  const [snap, setSnap] = useState<SnapshotResponse | null>(null);
  const [snapError, setSnapError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const goalsKey = JSON.stringify(goals);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    api
      .runs(profileId)
      .then((r) => alive && (setRuns(r), setRunsError(null)))
      .catch((e: unknown) => alive && setRunsError(e instanceof ApiError ? e : new ApiError(0, { code: "unknown", message: "We couldn't load your checks." })));
    return () => {
      alive = false;
    };
  }, [profileId, nonce]);

  useEffect(() => {
    if (!profileId || goalsKey === "null") return;
    let alive = true;
    api
      .snapshot(profileId)
      .then((s) => alive && (setSnap(s), setSnapError(null)))
      .catch((e: unknown) => alive && setSnapError(e instanceof ApiError ? e : new ApiError(0, { code: "unknown", message: "We couldn't count just now." })));
    return () => {
      alive = false;
    };
  }, [profileId, goalsKey, nonce]);

  if (profileError) {
    return (
      <div className={styles.home}>
        <InlineError title="We couldn't load your profile" message={profileError.message} hint={profileError.hint} onRetry={refresh} />
      </div>
    );
  }

  const name = profile ? firstName(profile.person.name) : "";
  const noRole = !university && !!goals && !goals.target_roles.length;
  const latest = new Map<ToolId, RunSummary>();
  for (const r of runs?.runs ?? []) if (known(r.tool)) latest.set(r.tool, r);
  const doneSteps = STEPS.map((s) => s.tools.some((t) => latest.has(t)));
  const doneCount = doneSteps.filter(Boolean).length;
  const nextStep = doneSteps.indexOf(false);
  const tileTools = [...TILE_ORDER.filter(known), ...TOOLS.map((t) => t.id).filter((id) => !TILE_ORDER.includes(id))];
  const hrefFor = (tool: ToolId) => {
    const r = latest.get(tool);
    return toolHref(tool, r ? r.params : goalParams(tool, goals, university));
  };

  return (
    <div className={styles.home}>
      {/* ---------------- your goal ---------------- */}
      <header className={styles.head}>
        <h1 className={styles.h1}>{name ? `Your plan, ${name}` : "Your plan"}</h1>
        <section className={styles.goal} aria-labelledby="goal-h">
          <div className={styles.goalTop}>
            <h2 id="goal-h" className={styles.kicker}>
              {university ? "Your graduates" : "Your goal"}
            </h2>
            <Link href="/onboarding?edit=1" className={styles.edit}>
              Edit
            </Link>
          </div>
          {profile && goals ? (
            <p className={styles.goalLine}>
              {university ? (
                <>
                  <span>
                    {compactSchool(goals.institution) || "Your institution"}
                    {goals.programs.length ? ` · ${goals.programs.join(", ")}` : ""}
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                  <span className="visually-hidden"> to </span>
                  <b>{goals.target_countries.length ? goals.target_countries.map(placeName).join(", ") : "wherever they went"}</b>
                </>
              ) : (
                <>
                  <span>{fromLine(profile)}</span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                  <span className="visually-hidden"> to </span>
                  <b>{toLine(goals)}</b>
                </>
              )}
            </p>
          ) : (
            <p className={styles.goalLine}>Loading your profile…</p>
          )}
          {noRole && (
            <div className={styles.prompt} role="note">
              <p>
                <b>Add the role you’re aiming for.</b> Routes, postings and competition all need a role to answer, so half your plan is waiting on
                it. A job title is enough, like Software Engineer.
              </p>
              <ButtonLink href="/onboarding?edit=1" size="sm">
                Add a role
              </ButtonLink>
            </div>
          )}
        </section>
      </header>

      {/* ---------------- right now (snapshot) ---------------- */}
      <section className={styles.block} aria-labelledby="now-h">
        <div className={styles.sectionHead}>
          <h2 id="now-h" className={styles.h2}>
            Right now
          </h2>
          <p className={styles.meta}>
            {snap ? `Exact counts of visible profiles and postings, as of ${formatDate(snap.data_date)}.` : "Counting a few things for your goal…"}
          </p>
        </div>
        {snapError ? (
          <InlineError title="We couldn't count these just now" message={snapError.message} hint={snapError.hint} onRetry={() => setNonce((n) => n + 1)} />
        ) : (
          <div className={styles.nowGrid}>
            {(snap?.tiles ?? Array.from({ length: university ? 2 : 3 }, () => null)).map((t, i) => (
              <NowTile key={t?.key ?? i} tile={t} />
            ))}
            {university && (
              <ConversionTile run={latest.get("internship_chances")} href={hrefFor("internship_chances")} />
            )}
          </div>
        )}
      </section>

      {/* ---------------- at a glance (latest runs) ---------------- */}
      {runsError ? (
        <div className={styles.block}>
          <InlineError title="We couldn't load your checks" message={runsError.message} hint={runsError.hint} onRetry={() => setNonce((n) => n + 1)} />
        </div>
      ) : (
        <TileRow
          className={styles.bandRow}
          band
          title="At a glance"
          note="The headline from the last time you ran each check. Opening one brings its full answer back."
          count={runs ? `${latest.size} of ${tileTools.length} checked` : undefined}
          label="Your checks"
        >
          {tileTools.map((tool) => (
            <GlanceTile key={tool} tool={tool} run={latest.get(tool)} loading={!runs} href={hrefFor(tool)} blocked={noRole && NEEDS_ROLE.includes(tool)} />
          ))}
        </TileRow>
      )}

      {/* ---------------- path ---------------- */}
      <div className={styles.lower}>
        <section className={styles.panel} aria-labelledby="path-h">
          <div className={styles.panelHead}>
            <h2 id="path-h" className={styles.h3}>
              Your path, step by step
            </h2>
            <span className={styles.progressText}>
              {doneCount} of {STEPS.length} done
            </span>
          </div>
          <div className={styles.progress} aria-hidden="true">
            {STEPS.map((s, i) => (
              <i key={s.title} className={doneSteps[i] ? styles.on : undefined} />
            ))}
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => {
              const done = doneSteps[i];
              const tool = s.tools.find((t) => latest.has(t)) ?? s.tools[0];
              const when = s.tools.map((t) => latest.get(t)?.finished_at).filter(Boolean).sort().pop();
              const isNext = i === nextStep;
              return (
                <li key={s.title} className={[styles.step, done && styles.stepDone, isNext && styles.stepNext].filter(Boolean).join(" ")}>
                  <span className={styles.stepMark} aria-hidden="true">
                    {done ? "✓" : i + 1}
                  </span>
                  <div className={styles.stepText}>
                    <p className={styles.stepTitle}>
                      {university ? s.titleUni : s.title}
                      <span className="visually-hidden">{done ? " (done)" : " (not done yet)"}</span>
                    </p>
                    <p className={styles.stepWhy}>
                      {university ? s.whyUni : s.why}
                      {done && when ? ` Checked ${ago(when)}.` : ""}
                    </p>
                  </div>
                  <ButtonLink href={hrefFor(tool)} size="sm" variant={isNext ? "primary" : "secondary"} slash={isNext} chevron={!isNext}>
                    {done ? "Open" : isNext ? "Start here" : "Start"}
                  </ButtonLink>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <footer className={styles.foot}>
        <p>
          “Right now” counts are exact totals of visible profiles and postings; groups under 5 people are never shown. Everything else is the
          headline of a check you ran; open it for its people count, coverage and date.
        </p>
      </footer>
    </div>
  );
}

/* ---------------- tiles ---------------- */

function Big({ h }: { h: { value?: number | null; display?: string | null } }) {
  const v = h.value;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e9) return <CellDigits value={v} pitch={6} gap={1} tone="current" label={fmtInt(v)} />;
  return <span className={styles.bigText}>{h.display}</span>;
}

const NEEDS_TEXT: Partial<Record<SnapshotTile["status"], string>> = {
  needs_role: "Add a target role to count this.",
  needs_country: "Add a target country to count this.",
  needs_institution: "Add your institution to count this.",
};

function NowTile({ tile }: { tile: SnapshotTile | null }) {
  if (!tile) {
    return (
      <div className={styles.now} aria-busy="true">
        <GridFill done={1} total={2} cells={40} size={10} />
        <p className={styles.nowLabel}>Counting…</p>
      </div>
    );
  }
  const href = toolHref(tile.tool as ToolId, tile.params);
  if (tile.status === "ok" || tile.status === "too_few") {
    return (
      <Link href={href} className={styles.now}>
        {tile.lead && tile.status === "ok" && <span className={styles.lead}>{tile.lead}</span>}
        <span className={styles.nowNum}>{tile.status === "ok" ? <Big h={tile} /> : <span className={styles.bigText}>{tile.display}</span>}</span>
        <span className={styles.nowLabel}>{tile.label}</span>
        {tile.detail && <span className={styles.nowDetail}>{tile.detail}</span>}
        <span className={styles.nowGo}>
          Open {known(tile.tool) ? toolName(tile.tool) : "the tool"} <Chevron size={14} />
        </span>
      </Link>
    );
  }
  return (
    <div className={["ad-dots", styles.now, styles.nowEmpty].join(" ")}>
      <div className={styles.nowCard}>
        <p className={styles.nowLabel}>{tile.label.charAt(0).toUpperCase() + tile.label.slice(1)}</p>
        <p className={styles.nowDetail}>{tile.status === "unavailable" ? (tile.detail ?? "We couldn't count this just now.") : NEEDS_TEXT[tile.status]}</p>
        {tile.status !== "unavailable" && (
          <ButtonLink href="/onboarding?edit=1" size="sm" variant="secondary" chevron>
            Edit your goal
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function ConversionTile({ run, href }: { run?: RunSummary; href: string }) {
  const h = run?.headline;
  if (!h) {
    return (
      <div className={["ad-dots", styles.now, styles.nowEmpty].join(" ")}>
        <div className={styles.nowCard}>
          <p className={styles.nowLabel}>Internship conversion for your graduates</p>
          <p className={styles.nowDetail}>Not checked yet.</p>
          <ButtonLink href={href} size="sm" variant="secondary" chevron>
            Check
          </ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <Link href={href} className={styles.now}>
      {h.lead && <span className={styles.lead}>{h.lead}</span>}
      <span className={styles.nowNum}>
        <Big h={h} />
      </span>
      <span className={styles.nowLabel}>{h.label}</span>
      <span className={styles.nowGo}>
        Open Internship → Job <Chevron size={14} />
      </span>
    </Link>
  );
}

function GlanceTile({ tool, run, loading, href, blocked }: { tool: ToolId; run?: RunSummary; loading: boolean; href: string; blocked: boolean }) {
  const name = toolName(tool);
  const h: Headline | null | undefined = run?.headline;
  if (run && h) {
    return (
      <Link href={href} className={styles.glance} data-tile="">
        <span className={styles.glanceTool}>{name}</span>
        <span className={styles.glanceBody}>
          {h.lead && <span className={styles.lead}>{h.lead}</span>}
          {h.display && (
            <span className={styles.glanceNum}>
              <Big h={h} />
            </span>
          )}
          <span className={styles.glanceLabel}>{h.label}</span>
        </span>
        <span className={styles.glanceFoot}>
          <span>Checked {ago(run.finished_at)}</span>
          <Chevron size={14} />
        </span>
      </Link>
    );
  }
  return (
    <div className={["ad-dots", styles.glance, styles.glanceEmpty].join(" ")} data-tile="">
      <span className={styles.glanceTool}>{name}</span>
      <div className={styles.glanceCard}>
        <p className={styles.glanceLabel}>{loading ? "Looking for your last check…" : run ? "Checked, but there’s no single number to show." : "Not checked yet"}</p>
        {!loading && (
          <>
            {blocked && !run && <Tag tone="soft">Needs a role</Tag>}
            <ButtonLink href={href} size="sm" variant="secondary" chevron>
              {run ? "Open" : "Check"}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
