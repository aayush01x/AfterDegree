"use client";
// /explore?d=<token>: one drill level. Runs the drill job for the token in the URL and renders
// the generic drill layout, or the company profile when the last step is a company.
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Job } from "@/lib/types";
import { useProfile } from "@/components/shell/ProfileContext";
import { JobProgress } from "@/components/data/JobProgress";
import { EmptyState } from "@/components/data/EmptyState";
import { InlineError } from "@/components/ui/InlineError";
import { ButtonLink } from "@/components/ui/Button";
import { DrillHeader } from "./DrillHeader";
import { DrillView } from "./DrillView";
import { CompanyView } from "./CompanyView";
import { decodeToken, lastStep } from "./token";
import { useDrillResult } from "./useDrillResult";
import styles from "./Drill.module.css";

export function ExploreView() {
  const sp = useSearchParams();
  const raw = sp.get("d");
  const token = decodeToken(raw);
  const { profileId } = useProfile();
  const state = useDrillResult(profileId, token);
  const label = lastStep(token)?.label ?? sp.get("l") ?? "This group";

  useEffect(() => {
    document.title = `${state.result?.title ?? label} · AfterDegree`;
  }, [state.result?.title, label]);

  if (!token) {
    return (
      <div className={styles.page}>
        <EmptyState
          tone="field"
          title="This link doesn't open a group"
          actions={
            <ButtonLink href="/home" variant="primary">
              Back to people like you
            </ButtonLink>
          }
        >
          It may have been cut short when it was copied. Open any count on your home screen or in a tool to go one level deeper.
        </EmptyState>
      </div>
    );
  }

  const { result, phase, job, error } = state;

  if (result) {
    return result.company ? <CompanyView token={token} result={result} /> : <DrillView token={token} result={result} />;
  }

  return (
    <div className={styles.page}>
      <DrillHeader token={token} />
      <h1 className={styles.loadingTitle}>{label}</h1>
      {phase === "error" && error ? (
        <div className={styles.narrow}>
          <InlineError
            title={`We couldn't open ${label}`}
            message={error.message}
            hint={error.hint ?? "Counts come from live profile searches; a second try often works."}
            onRetry={state.retry}
          />
        </div>
      ) : (
        <div className={styles.loadingPanel}>
          <JobProgress
            phase={phase}
            job={job as unknown as Job | null}
            cells={96}
            note="Counting the people behind this number with every filter you came with. Saved groups open at once."
          />
        </div>
      )}
    </div>
  );
}
