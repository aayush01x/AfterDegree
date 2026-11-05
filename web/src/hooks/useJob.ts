"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Job, ResultEnvelope, ToolId } from "@/lib/types";

export type JobPhase = "idle" | "starting" | "queued" | "running" | "done" | "error";

export interface JobState {
  phase: JobPhase;
  job: Job | null;
  result: ResultEnvelope | null;
  error: ApiError | null;
}

const IDLE: JobState = { phase: "idle", job: null, result: null, error: null };
const POLL_MS = 600;

/**
 * Starts a tool job and polls GET /api/jobs/{id} until done or error.
 * Cached runs come back done on the first poll.
 */
export function useJob() {
  const [state, setState] = useState<JobState>(IDLE);
  const runId = useRef(0);

  useEffect(() => () => void (runId.current += 1), []);

  const run = useCallback(async (tool: ToolId, profileId: string, params: Record<string, unknown>) => {
    const id = ++runId.current;
    const alive = () => id === runId.current;
    setState({ phase: "starting", job: null, result: null, error: null });
    try {
      const { job_id } = await api.startTool(tool, profileId, params);
      for (;;) {
        if (!alive()) return;
        const job = await api.getJob(job_id);
        if (!alive()) return;
        if (job.status === "done") {
          setState({ phase: "done", job, result: job.result ?? null, error: null });
          return;
        }
        if (job.status === "error") {
          setState({
            phase: "error",
            job,
            result: null,
            error: new ApiError(500, job.error ?? { code: "job_failed", message: "This run didn't finish." }),
          });
          return;
        }
        setState({ phase: job.status, job, result: null, error: null });
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (e) {
      if (!alive()) return;
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(0, { code: "unknown", message: "Something unexpected happened.", hint: "Try again." });
      setState({ phase: "error", job: null, result: null, error: err });
    }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setState(IDLE);
  }, []);

  return { ...state, run, reset };
}
