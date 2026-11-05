"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useJob } from "@/hooks/useJob";
import { nestBody, toolBySlug, type ToolField } from "@/lib/tools";
import type { ResultEnvelope } from "@/lib/types";
import { JobProgress } from "@/components/data/JobProgress";
import { GridFill } from "@/components/data/GridFill";
import { ResultView } from "@/components/data/ResultView";
import { Button } from "@/components/ui/Button";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { useProfile } from "@/components/shell/ProfileContext";
import { ToolFields } from "./ToolFields";
import styles from "./ToolLayout.module.css";

export interface ToolLayoutProps {
  /** Tool slug, e.g. "job-postings". */
  tool: string;
  title?: string;
  purpose?: string;
  /** Custom inputs (with `name` attributes), rendered inside ToolLayout's form. */
  form?: ReactNode;
  /** Used when `form` is absent. Defaults to lib/tools.ts. */
  fields?: ToolField[];
  defaults?: Record<string, string>;
  /** Turn the submitted FormData into the request body (besides profile_id). */
  buildParams?: (fd: FormData) => Record<string, unknown>;
  /** Convert the flat string form values to the contract body (a feature's `toParams`/`toBody`). Ignored when buildParams is set. */
  toParams?: (values: Record<string, string>) => object;
  /** Render the finished result. Defaults to <ResultView />. */
  resultView?: (result: ResultEnvelope) => ReactNode;
  runLabel?: string;
  /** Run on arrival when required fields are already filled. */
  autoRun?: boolean;
}

/** Shared frame for every tool: title, purpose, parameter form, run, progress, result. */
export function ToolLayout({ tool, title, purpose, form, fields, defaults, buildParams, toParams, resultView, runLabel = "Run", autoRun = true }: ToolLayoutProps) {
  const def = toolBySlug(tool);
  const { profileId, goals, university, loading: profileLoading } = useProfile();
  const search = useSearchParams();
  const job = useJob();
  const formRef = useRef<HTMLFormElement>(null);
  /** Search string of the last automatic run, so a URL change re-runs but a re-render does not. */
  const lastAutoKey = useRef<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const list = useMemo(() => fields ?? def?.fields ?? [], [fields, def]);

  const values = useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of list) {
      v[f.name] = search.get(f.name) ?? (goals && f.fromGoals?.(goals)) ?? defaults?.[f.name] ?? "";
    }
    return v;
  }, [list, search, goals, defaults]);

  const submit = (formEl: HTMLFormElement) => {
    if (!def || !profileId) return;
    const fd = new FormData(formEl);
    if (!form) {
      const errs: Record<string, string> = {};
      for (const f of list) if (f.required && !String(fd.get(f.name) ?? "").trim()) errs[f.name] = `Add ${f.label.toLowerCase()} to run this.`;
      setErrors(errs);
      if (Object.keys(errs).length) return;
    }
    const flat: Record<string, string> = {};
    for (const f of list) flat[f.name] = "";
    for (const [k, v] of fd.entries()) flat[k] = String(v);
    let params: Record<string, unknown> | null = null;
    if (buildParams) params = buildParams(fd);
    else if (toParams) {
      try {
        params = { ...(toParams(flat) as Record<string, unknown>) };
      } catch {
        params = null;
      }
    }
    params ??= nestBody(flat);
    if (university && goals) Object.assign(params, { institution: goals.institution, programs: goals.programs });
    void job.run(def.id, profileId, params);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(e.currentTarget);
  };

  const ready = !profileLoading && !!profileId && !!goals;
  const searchKey = search.toString();
  // Run on arrival, and again whenever the URL's query changes (feature views re-run by navigating with new params).
  useEffect(() => {
    if (!ready || !formRef.current) return;
    if (lastAutoKey.current === searchKey) return;
    const first = lastAutoKey.current === null;
    if (first && !autoRun && !searchKey) return;
    const allFilled = list.filter((f) => f.required).every((f) => values[f.name]?.trim());
    if (!allFilled) {
      lastAutoKey.current = searchKey;
      return;
    }
    lastAutoKey.current = searchKey;
    submit(formRef.current);
    // submit is stable enough for a keyed auto run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoRun, list, values, searchKey]);

  if (!def) return <InlineError message="This tool doesn't exist." />;
  const busy = job.phase === "starting" || job.phase === "queued" || job.phase === "running";
  const hasHints = list.some((f) => f.help);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title ?? def.title}</h1>
          <ExampleBadge />
        </div>
        <p className={styles.purpose}>{purpose ?? (university ? def.purposeUniversity : def.purpose)}</p>
      </header>

      {ready ? (
        <form
          ref={formRef}
          key={JSON.stringify(values)}
          aria-label="Your question"
          className={[styles.form, hasHints && styles.formHasHints].filter(Boolean).join(" ")}
          onSubmit={onSubmit}
          noValidate
        >
          <div className={styles.formFields}>{form ?? <ToolFields fields={list} values={values} errors={errors} />}</div>
          <div className={styles.actions}>
            <Button type="submit" loading={busy}>
              {busy ? "Running" : runLabel}
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.skeleton} aria-busy="true">
          <GridFill done={0} total={1} cells={24} size={12} onOrange />
        </div>
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
          onRetry={() => formRef.current && submit(formRef.current)}
        />
      )}

      {job.phase === "done" && job.result && (
        <div className={styles.results}>{resultView ? resultView(job.result) : <ResultView result={job.result} />}</div>
      )}

      {job.phase === "idle" && ready && (
        <div className={styles.empty}>
          <span className={styles.emptyCells} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <p>
            Fill in what you know and press {runLabel}. Every answer comes with how many people it rests on and how sure it is.
          </p>
        </div>
      )}
    </div>
  );
}
