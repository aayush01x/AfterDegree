"use client";
// "How this compares to you": the opened path and the user's own path on one half-year axis,
// where the user is now, and the steps this person took that the user has not (yet).
import type { CSSProperties } from "react";
import type { PersonStep } from "@/lib/drill-types";
import type { StoredProfile, ToolId } from "@/lib/types";
import { homeCountry, stageOf, stageToken, stageLabel, type Stage } from "@/components/art/stages";
import { ButtonLink } from "@/components/ui/Button";
import { toolHref } from "@/lib/tools";
import { bandOf, NOW_HALF, NOW_YEAR } from "./CareerTimeline";
import styles from "./Person.module.css";

/** The signed-in user's own profile as path steps (education + experience, years only). */
export function ownSteps(profile: StoredProfile | null): PersonStep[] {
  if (!profile) return [];
  const country = profile.person.location?.country ?? "India";
  const yr = (d: string | null) => (d ? Number(d.slice(0, 4)) : null);
  const edu: PersonStep[] = profile.person.education.map((e) => ({
    kind: "education",
    org: e.school,
    title: [e.degree, e.field].filter(Boolean).join(", "),
    country: e.school_country ?? country,
    start_year: e.start_year,
    end_year: e.end_year,
    years: e.start_year != null && e.end_year != null ? e.end_year - e.start_year : null,
  }));
  const work: PersonStep[] = profile.person.experience
    .filter((x) => !/trainee/i.test(x.title) || !profile.person.experience.some((y) => y !== x && y.company === x.company && !/trainee/i.test(y.title)))
    .map((x) => {
      const s = yr(x.start_date);
      const e = yr(x.end_date);
      const months = x.start_date ? monthsBetween(x.start_date, x.end_date) : null;
      return {
        kind: /intern|working student|trainee/i.test(x.title) || x.seniority === "Intern" ? "internship" : "work",
        org: x.company,
        title: x.title,
        country,
        start_year: s,
        end_year: e,
        years: months != null ? Math.max(0.5, Math.round(months / 6) / 2) : null,
      } as PersonStep;
    });
  return [...edu, ...work];
}

function monthsBetween(a: string, b: string | null): number {
  const [ay, am] = a.split("-").map(Number);
  const now = new Date();
  const [by, bm] = b ? b.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return Math.max(0, (by - ay) * 12 + ((bm || 1) - (am || 1)) + 1);
}

/** One stage per half-year column (latest-starting step wins); null = no role listed. */
function columns(steps: PersonStep[], from: number, cols: number): (Stage | null)[] {
  const home = homeCountry(steps);
  const out: (Stage | null)[] = Array(cols).fill(null);
  const bands = steps.map((s) => bandOf(s, from, home)).filter(Boolean).sort((a, b) => a!.start - b!.start);
  for (const b of bands) for (let c = b!.start; c < Math.min(cols, b!.end); c++) out[c] = b!.stage;
  return out;
}

export interface CompareProps {
  theirs: PersonStep[];
  profile: StoredProfile | null;
  company?: string;
  country?: string;
  sameRouteHref?: string;
}

export function ComparePanel({ theirs, profile, company, country, sameRouteHref }: CompareProps) {
  const mine = ownSteps(profile);
  const startOf = (xs: PersonStep[]) => xs.find((s) => s.kind === "education")?.start_year ?? xs[0]?.start_year ?? NOW_YEAR - 6;
  const from = Math.min(startOf(theirs), mine.length ? startOf(mine) : Infinity);
  const nowCol = (NOW_YEAR - from) * 2 + NOW_HALF;
  const cols = nowCol + 1;
  const a = columns(theirs, from, cols);
  const b = mine.length ? columns(mine, from, cols) : [];
  const home = homeCountry(theirs);
  const moved = theirs.find((s) => s.country && s.country !== home && s.start_year != null);
  const moveCol = moved?.start_year != null ? (moved.start_year - from) * 2 : null;
  const myLastWork = [...mine].filter((s) => s.kind !== "education").sort((x, y) => (x.start_year ?? 0) - (y.start_year ?? 0)).pop();
  const myEdu = mine.filter((s) => s.kind === "education").map((s) => s.end_year ?? 0);
  const workYears = myEdu.length ? Math.max(0, NOW_YEAR - Math.max(...myEdu)) : null;
  const gapCols = b.map((s, i) => (s === null && i >= (Math.max(...myEdu, from) - from) * 2 ? i : -1)).filter((i) => i >= 0);
  const firstGap = gapCols[0];
  const lastGap = gapCols[gapCols.length - 1];
  const myStages = new Set(b.filter(Boolean));
  const firstWorkTheirs = theirs.find((s) => s.kind !== "education");
  const theirNext = theirs.filter((s) => {
    const st = stageOf(s, home);
    return (st === "masters" || st === "intern") && !myStages.has(st) && (s.start_year ?? 0) >= (firstWorkTheirs?.start_year ?? 0);
  });
  const sameStart = theirs[0] && mine[0] && theirs[0].org.toLowerCase().includes((mine[0].org.split(",")[0].split(" ")[0] ?? "").toLowerCase());
  const tick = (c: number) => c % 4 === 0;
  const style = { ["--cols" as string]: cols } as CSSProperties;

  return (
    <section className={styles.panel} aria-labelledby="compare-title">
      <header className={styles.panelHead}>
        <h2 id="compare-title" className={styles.panelTitle}>
          How this compares to you
        </h2>
        {sameStart && theirs[0]?.end_year && <span className={styles.key}>Same start: {theirs[0].org}, {theirs[0].end_year}</span>}
      </header>
      {mine.length === 0 ? (
        <p className={styles.small}>Your profile has no dated education or work yet, so we can&rsquo;t line the two paths up. Add them by editing your profile.</p>
      ) : (
        <>
          <div className={styles.cmpScroll}>
            <div className={styles.cmp} style={style} role="img" aria-label={`This path and yours from ${from} to today. ${moved ? `They moved in ${moved.start_year}.` : ""} You are ${workYears ?? "a few"} years into work.`}>
              <span className={styles.cmpYears} aria-hidden="true">
                {Array.from({ length: cols }, (_, c) =>
                  tick(c) || c === moveCol ? (
                    <span key={c} style={{ gridColumn: `${c + 2} / span ${c === moveCol ? 4 : 2}` }} className={c === moveCol ? styles.cmpMove : undefined}>
                      {from + c / 2}
                      {c === moveCol ? " · they moved" : ""}
                    </span>
                  ) : null,
                )}
              </span>
              <span className={styles.cmpLabel}>This path</span>
              {a.map((s, c) => (
                <i key={`a${c}`} className={[styles.cmpCell, s === "intern" && styles.cmpPart, !s && styles.cmpGap].filter(Boolean).join(" ")} style={{ gridColumn: c + 2, ["--c" as string]: s ? stageToken(s) : undefined } as CSSProperties} />
              ))}
              <span className={styles.cmpLabel}>You</span>
              {b.map((s, c) => (
                <i
                  key={`b${c}`}
                  className={[styles.cmpCell, s === "intern" && styles.cmpPart, !s && "ad-dots", !s && styles.cmpGap, c === nowCol && styles.cmpHere].filter(Boolean).join(" ")}
                  style={{ gridColumn: c + 2, ["--c" as string]: s ? stageToken(s) : undefined } as CSSProperties}
                />
              ))}
              {moveCol != null && <span className={styles.cmpMoveLine} style={{ gridColumn: moveCol + 2 }} />}
            </div>
          </div>
          <div className={styles.cmpNotes}>
            {firstGap != null && (
              <span className={styles.small}>
                <i className={["ad-dots", styles.gapSwatch].join(" ")} aria-hidden="true" /> No role listed, {from + Math.floor(firstGap / 2)}–{from + Math.floor(lastGap / 2)}
              </span>
            )}
            <span className={styles.hereTag}>
              You are here{workYears != null ? `: ${workYears} ${workYears === 1 ? "year" : "years"} into work` : ""}
              {myLastWork ? ` at ${myLastWork.org}` : ""}
            </span>
          </div>
          {theirNext.length > 0 && (
            <>
              <h3 className={styles.subhead}>Next steps they took that you haven&rsquo;t yet</h3>
              <ul className={styles.nextSteps}>
                {theirNext.map((s) => {
                  const st = stageOf(s, home);
                  return (
                    <li key={`${s.org}-${s.start_year}`} className={styles.nextStep}>
                      <i className={[styles.swatch, st === "intern" && styles.swatchHollow].filter(Boolean).join(" ")} style={{ ["--c" as string]: stageToken(st) } as CSSProperties} aria-hidden="true" />
                      <span>
                        <strong>{st === "masters" ? `${s.title?.split(" ")[0] ?? "Master's"} in ${s.country}` : s.title ?? stageLabel(st)}</strong>
                        <small>
                          {s.org} · {s.start_year}
                          {s.years ? ` · ${s.years} yr${s.years === 1 ? "" : "s"}` : ""}
                          {st === "intern" ? ", during the master's" : ""}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      <div className={styles.actions}>
        {company && (
          <ButtonLink href={toolHref("internship_chances" as ToolId, { company, ...(country ? { country } : {}) })} variant="primary">
            See Internship-to-Job chances at {company}
          </ButtonLink>
        )}
        {sameRouteHref && (
          <ButtonLink href={sameRouteHref} variant="secondary">
            See who else took this route
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
