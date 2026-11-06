"use client";
// Runs a drill job (POST /api/drill, then polls GET /api/jobs/{id}) with the same phases as
// hooks/useJob.ts, and keeps finished results per token for the session so the back button,
// breadcrumbs and person prev/next are instant.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type DrillJob } from "@/lib/api";
import type { DrillResultFull, DrillToken, PersonDetailFull } from "@/lib/drill-types";
import type { JobPhase } from "@/hooks/useJob";
import { tokenKey } from "./token";

const POLL_MS = 600;
const CACHE_PREFIX = "afterdegree.drill.v2.";

export interface DrillState {
  phase: JobPhase;
  job: DrillJob | null;
  result: DrillResultFull | null;
  error: ApiError | null;
}

const IDLE: DrillState = { phase: "idle", job: null, result: null, error: null };

function cacheKey(profileId: string, token: DrillToken) {
  return `${CACHE_PREFIX}${profileId}.${tokenKey(token)}`;
}

export function readCachedDrill(profileId: string, token: DrillToken): DrillResultFull | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(profileId, token));
    return raw ? (JSON.parse(raw) as DrillResultFull) : null;
  } catch {
    return null;
  }
}

function writeCachedDrill(profileId: string, token: DrillToken, result: DrillResultFull) {
  try {
    window.sessionStorage.setItem(cacheKey(profileId, token), JSON.stringify(result));
  } catch {
    /* storage full or blocked: the next visit re-runs the job */
  }
}

const asApiError = (e: unknown) =>
  e instanceof ApiError
    ? e
    : new ApiError(0, { code: "unknown", message: "Something unexpected happened.", hint: "Try again." });

/** Fetch the drill result for a token. `token` null = nothing to run. */
export function useDrillResult(profileId: string | null | undefined, token: DrillToken | null) {
  const [state, setState] = useState<DrillState>(IDLE);
  const runId = useRef(0);
  const key = token && profileId ? cacheKey(profileId, token) : null;

  const run = useCallback(
    async (force = false) => {
      if (!token || !profileId) return;
      const id = ++runId.current;
      const alive = () => id === runId.current;
      const cached = force ? null : readCachedDrill(profileId, token);
      if (cached) {
        setState({ phase: "done", job: null, result: cached, error: null });
        return;
      }
      setState({ phase: "starting", job: null, result: null, error: null });
      try {
        const { job_id } = await api.drill(profileId, token);
        for (;;) {
          if (!alive()) return;
          const job = await api.getDrillJob(job_id);
          if (!alive()) return;
          if (job.status === "done" && job.result) {
            writeCachedDrill(profileId, token, job.result);
            setState({ phase: "done", job, result: job.result, error: null });
            return;
          }
          if (job.status === "error" || job.status === "done") {
            setState({
              phase: "error",
              job,
              result: null,
              error: new ApiError(500, job.error ?? { code: "job_failed", message: "This group didn't finish loading." }),
            });
            return;
          }
          setState({ phase: job.status, job, result: null, error: null });
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (e) {
        if (alive()) setState({ phase: "error", job: null, result: null, error: asApiError(e) });
      }
    },
    // `key` captures token + profile identity; the token object itself changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    // Starting the job is the point of this effect; state updates arrive asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    return () => void (runId.current += 1);
  }, [run]);

  return { ...state, retry: () => void run(true) };
}

export interface PersonState {
  person: PersonDetailFull | null;
  error: ApiError | null;
  loading: boolean;
}

/** GET /api/people/{id}. */
export function usePerson(profileId: string | null | undefined, personId: string | null) {
  const [state, setState] = useState<PersonState & { key: string | null }>({ person: null, error: null, loading: true, key: null });
  const [nonce, setNonce] = useState(0);
  const key = profileId && personId ? `${profileId}:${personId}:${nonce}` : null;

  useEffect(() => {
    if (!profileId || !personId) return;
    let alive = true;
    api
      .person(personId, profileId)
      .then((person) => alive && setState({ person, error: null, loading: false, key }))
      .catch((e: unknown) => alive && setState({ person: null, error: asApiError(e), loading: false, key }));
    return () => {
      alive = false;
    };
  }, [profileId, personId, key]);

  const current = state.key === key ? state : { person: null, error: null, loading: true };
  return { person: current.person, error: current.error, loading: current.loading, retry: () => setNonce((n) => n + 1) };
}
