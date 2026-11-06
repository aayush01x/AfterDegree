"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useJob } from "@/hooks/useJob";
import type { MergedPage } from "@/lib/pages";
import type { ToolId } from "@/lib/types";
import type { FeatureModule } from "@/features/types";
import { JobProgress } from "@/components/data/JobProgress";
import { GridFill } from "@/components/data/GridFill";
import { ResultView } from "@/components/data/ResultView";
import { Button } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { useProfile } from "@/components/shell/ProfileContext";
import { ToolFields } from "./ToolFields";
import styles from "./ToolLayout.module.css";
import tabStyles from "./MergedToolPage.module.css";

/**
 * Two tools behind one form. The answers live in the URL; each tab runs its own tool the first
 * time it is shown for the current answers, and keeps that result while you switch back and forth.
 */
export function MergedToolPage({ page, features }: { page: MergedPage; features: Partial<Record<ToolId, FeatureModule>> }) {
  const { profileId, profile, goals, university, loading: profileLoading } = useProfile();
  const derived = profile?.derived ?? null;
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // One job per tab (hooks must be called unconditionally, so a fixed maximum of three tabs).
  const jobs = [useJob(), useJob(), useJob()];
  const lastRun = useRef<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tabIndex = Math.max(0, page.tabs.findIndex((t) => t.key === search.get("tab")));
  const tab = page.tabs[tabIndex];
  const job = jobs[tabIndex];

  const values = useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of page.fields) {
      v[f.name] =
        search.get(f.name) ??
        search.get(`scope.${f.name}`) ??
        ((goals && f.fromGoals?.(goals)) || undefined) ??
        ((derived && f.fromProfile?.(derived, goals)) || undefined) ??
        "";
    }
    // Older links may carry the goal as one sentence.
    const goalText = search.get("goal_text");
    if (goalText && !search.get("role")) v.goal_text = goalText;
    return v;
  }, [page.fields, search, goals, derived]);

  const missing = (tab.requires ?? []).filter((k) => !values[k]?.trim() && !(k === "role" && values.goal_text));
  const params = useMemo(() => {
    const p: Record<string, unknown> = tab.toParams(values);
    if (university && goals) Object.assign(p, { institution: goals.institution, programs: goals.programs });
    return p;
  }, [tab, values, university, goals]);
  const runKey = JSON.stringify(params);
  const hasQuestion = search.toString().length > 0;
  const ready = !profileLoading && !!profileId && !!goals;

  // Run the visible tab when it has never run for these answers.
  useEffect(() => {
    if (!ready || !profileId || missing.length) return;
    // Opened from the sidebar with no question in the URL: wait for the button.
    if (!hasQuestion) return;
    if (lastRun.current[tab.key] === runKey) return;
    lastRun.current[tab.key] = runKey;
    void job.run(tab.tool, profileId, params);
    // job identity changes every render; tab + runKey decide when to run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profileId, tab.key, runKey, missing.length, hasQuestion]);

  const go = (next: Record<string, string>, tabKey: string) => {
    const qs = new URLSearchParams();
    qs.set("tab", tabKey);
    for (const [k, v] of Object.entries(next)) if (v?.trim() && k !== "tab") qs.set(k, v.trim());
    router.push(`${pathname}?${qs.toString()}`, { scroll: false });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    for (const f of page.fields) next[f.name] = String(fd.get(f.name) ?? "");
    const errs: Record<string, string> = {};
    for (const f of page.fields) if (f.required && !next[f.name].trim()) errs[f.name] = `Add ${f.label.toLowerCase()} to run this.`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Same answers again: run the visible tab afresh.
    if (page.fields.every((f) => (next[f.name] ?? "") === (values[f.name] ?? "")) && profileId) {
      lastRun.current[tab.key] = runKey;
      void job.run(tab.tool, profileId, params);
      return;
    }
    go(next, tab.key);
  };

  const feature = features[tab.tool];
  const View = feature?.View;
  const busy = job.phase === "starting" || job.phase === "queued" || job.phase === "running";
  const hasHints = page.fields.some((f) => f.help);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{page.title}</h1>
          <ExampleBadge />
        </div>
        <p className={styles.purpose}>{university ? page.purposeUniversity : page.purpose}</p>
      </header>

      {ready ? (
        <form
          key={JSON.stringify(values)}
          aria-label="Your question"
          className={[styles.form, hasHints && styles.formHasHints].filter(Boolean).join(" ")}
          onSubmit={onSubmit}
          noValidate
        >
          <div className={styles.formFields}>
            <ToolFields fields={page.fields} values={values} errors={errors} />
          </div>
          <div className={styles.actions}>
            <Button type="submit" loading={busy}>
              {busy ? "Running" : page.runLabel}
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.skeleton} aria-busy="true">
          <GridFill done={0} total={1} cells={24} size={12} onOrange />
        </div>
      )}

      <div className={tabStyles.tabs} role="tablist" aria-label={`${page.title} views`}>
        {page.tabs.map((t, i) => {
          const j = jobs[i];
          const state = j.phase === "done" ? "ready" : j.phase === "idle" ? "" : j.phase === "error" ? "error" : "running";
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={i === tabIndex}
              className={tabStyles.tab}
              onClick={() => i !== tabIndex && go({ ...values }, t.key)}
            >
              <span className={tabStyles.tabLabel}>{t.label}</span>
              {state && <span className={tabStyles.tabState} data-state={state} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className={tabStyles.blurb}>{(university && tab.blurbUniversity) || tab.blurb}</p>

      {ready && hasQuestion && missing.length > 0 && (
        <InlineError title="One more thing" message="Add the role you're aiming for, then press the button." />
      )}

      {busy && (
        <section className={styles.progress} aria-label="Working on it">
          <JobProgress phase={job.phase} job={job.job} cells={96} size={16} onOrange />
        </section>
      )}

      {job.phase === "error" && job.error && (
        <InlineError
          title="This run didn't finish"
          message={job.error.message}
          hint={job.error.hint}
          onRetry={() => profileId && void job.run(tab.tool, profileId, params)}
        />
      )}

      {job.phase === "done" && job.result && (
        <div className={styles.results} role="tabpanel">
          {View ? <View result={job.result} /> : <ResultView result={job.result} />}
        </div>
      )}
      {job.phase === "idle" && ready && !(hasQuestion && missing.length > 0) && (
        <div className={styles.empty}>
          <span className={styles.emptyCells} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <p>
            Your answers are filled in from your profile. Check them and press {page.runLabel}. Every answer comes with how many people it
            rests on and how sure it is.
          </p>
        </div>
      )}
    </div>
  );
}
