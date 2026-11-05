"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useJob } from "@/hooks/useJob";
import { nestBody, toolBySlug, type ToolField } from "@/lib/tools";
import type { ResultEnvelope } from "@/lib/types";
import { Panel } from "@/components/data/Panel";
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
  /** Render the finished result. Defaults to <ResultView />. */
  resultView?: (result: ResultEnvelope) => ReactNode;
  runLabel?: string;
  /** Run on arrival when required fields are already filled. */
  autoRun?: boolean;
}

/** Shared frame for every tool: title, purpose, parameter form, run, progress, result. */
export function ToolLayout({ tool, title, purpose, form, fields, defaults, buildParams, resultView, runLabel = "Run", autoRun = true }: ToolLayoutProps) {
  const def = toolBySlug(tool);
  const { profileId, goals, university, loading: profileLoading } = useProfile();
  const search = useSearchParams();
  const job = useJob();
  const formRef = useRef<HTMLFormElement>(null);
  const autoRan = useRef(false);
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
    const params = buildParams
      ? buildParams(fd)
      : nestBody(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
    if (university && goals) Object.assign(params, { institution: goals.institution, programs: goals.programs });
    void job.run(def.id, profileId, params);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(e.currentTarget);
  };

  const ready = !profileLoading && !!profileId && !!goals;
  useEffect(() => {
    if (!ready || !autoRun || autoRan.current || !formRef.current) return;
    const allFilled = list.filter((f) => f.required).every((f) => values[f.name]?.trim());
    if (!allFilled) return;
    autoRan.current = true;
    submit(formRef.current);
    // submit is stable enough for a one-shot auto run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoRun, list, values]);

  if (!def) return <InlineError message="This tool doesn't exist." />;
  const busy = job.phase === "starting" || job.phase === "queued" || job.phase === "running";
  const hasHints = list.some((f) => f.help);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.tag}>
          <ExampleBadge />
        </div>
        <h1 className={styles.title}>{title ?? def.title}</h1>
        <p className={styles.purpose}>{purpose ?? (university ? def.purposeUniversity : def.purpose)}</p>
      </header>

      <Panel title="Your question" headingLevel={2}>
        {ready ? (
          <form ref={formRef} key={JSON.stringify(values)} className={[styles.form, hasHints && styles.formHasHints].filter(Boolean).join(" ")} onSubmit={onSubmit} noValidate>
            <div className={styles.formFields}>{form ?? <ToolFields fields={list} values={values} errors={errors} />}</div>
            <div className={styles.actions}>
              <Button type="submit" loading={busy}>
                {busy ? "Running" : runLabel}
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.skeleton} aria-busy="true">
            <GridFill done={0} total={1} cells={24} size={12} />
          </div>
        )}
      </Panel>

      {busy && (
        <Panel title="Working on it">
          <JobProgress phase={job.phase} job={job.job} />
        </Panel>
      )}

      {job.phase === "error" && job.error && (
        <InlineError
          title="This run didn't finish"
          message={job.error.message}
          hint={job.error.hint}
          onRetry={() => formRef.current && submit(formRef.current)}
        />
      )}

      {job.phase === "done" && job.result && (resultView ? resultView(job.result) : <ResultView result={job.result} />)}

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
