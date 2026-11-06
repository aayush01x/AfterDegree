import type {
  ApiErrorBody,
  ChatMessage,
  ChatResponse,
  CompleteResponse,
  Evidence,
  Goals,
  Health,
  Job,
  ProfileResponse,
  StoredProfile,
  ToolId,
} from "./types";
import { toolById } from "./tools";
import type { DrillResultFull, DrillToken, PersonDetailFull } from "./drill-types";

/** "mock" serves fixtures in the browser; "live" calls /api/* (proxied to the engine). */
export const API_MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
export const IS_MOCK = API_MODE === "mock";

export class ApiError extends Error {
  code: string;
  hint?: string;
  status: number;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.hint = body.hint;
  }
}

type Method = "GET" | "POST";

async function liveRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, {
      code: "network",
      message: "We couldn't reach the AfterDegree engine.",
      hint: "Check your connection, or that the engine is running, then try again.",
    });
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (json as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(
      res.status,
      err ?? {
        code: `http_${res.status}`,
        message: "Something went wrong on our side.",
        hint: "Try again in a moment.",
      },
    );
  }
  return json as T;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (IS_MOCK) {
    const { mockRequest } = await import("@/mocks/server");
    const { status, body: out } = await mockRequest(method, path, body);
    if (status >= 400) throw new ApiError(status, (out as { error: ApiErrorBody }).error);
    return out as T;
  }
  return liveRequest<T>(method, path, body);
}

export const api = {
  createProfile: (linkedin_url: string) =>
    request<ProfileResponse>("POST", "/onboarding/profile", { linkedin_url }),
  chat: (profile_id: string, messages: ChatMessage[]) =>
    request<ChatResponse>("POST", "/onboarding/chat", { profile_id, messages }),
  complete: (profile_id: string, goals: Goals) =>
    request<CompleteResponse>("POST", "/onboarding/complete", { profile_id, goals }),
  getProfile: (profile_id: string) => request<StoredProfile>("GET", `/profiles/${profile_id}`),
  startTool: (tool: ToolId, profile_id: string, params: Record<string, unknown>) =>
    request<{ job_id: string }>("POST", toolById(tool).endpoint, { profile_id, ...params }),
  getJob: (job_id: string) => request<Job>("GET", `/jobs/${job_id}`),
  getEvidence: (id: string) => request<Evidence>("GET", `/evidence/${id}`),
  health: () => request<Health>("GET", "/health"),
  /** Start a drill job (CONTRACT Appendix C). Poll it with `getDrillJob`. */
  drill: (profile_id: string, drill: DrillToken) =>
    drillRequest<{ job_id: string }>("POST", "/drill", { profile_id, drill }),
  getDrillJob: (job_id: string) => drillRequest<DrillJob>("GET", `/jobs/${job_id}`),
  /** One anonymous career path (PersonDetail). */
  person: (person_id: string, profile_id: string) =>
    drillRequest<PersonDetailFull>(
      "GET",
      `/people/${encodeURIComponent(person_id)}?profile_id=${encodeURIComponent(profile_id)}`,
    ),
};

/* ---------- Drill-down (additive) ---------- */

export interface DrillJob {
  job_id: string;
  tool: "drill";
  status: Job["status"];
  progress: Job["progress"];
  result?: DrillResultFull;
  error?: ApiErrorBody;
}

/**
 * Development only: `?drillmock=1` on any page serves drill and person requests from the
 * in-browser fixtures while the engine has no /api/drill yet (`?drillmock=0` turns it off).
 */
export function drillMockActive(): boolean {
  if (IS_MOCK) return true;
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("drillmock");
    if (q === "1") window.sessionStorage.setItem("afterdegree.drillmock", "1");
    if (q === "0") window.sessionStorage.removeItem("afterdegree.drillmock");
    return window.sessionStorage.getItem("afterdegree.drillmock") === "1";
  } catch {
    return false;
  }
}

/** Drop state left by the old "example data" fallback, which showed another person's (fixture)
 * results in live mode. Live drill-downs now only ever come from the engine. */
(() => {
  try {
    if (typeof window === "undefined" || IS_MOCK) return;
    window.sessionStorage.removeItem("afterdegree.drill-fallback");
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("afterdegree.drill.") && !k.startsWith("afterdegree.drill.v2.")) window.sessionStorage.removeItem(k);
    }
  } catch {
    /* storage blocked */
  }
})();

/** True when drill-downs are showing the built-in example data (mock mode or `?drillmock=1` in dev). */
export function drillUsesExamples(): boolean {
  return drillMockActive();
}

async function drillRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (drillMockActive()) {
    const { mockRequest } = await import("@/mocks/server");
    const { status, body: out } = await mockRequest(method, path, body);
    if (status >= 400) throw new ApiError(status, (out as { error: ApiErrorBody }).error);
    return out as T;
  }
  try {
    return await liveRequest<T>(method, path, body);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405) && (path === "/drill" || path.startsWith("/people/"))) {
      throw new ApiError(e.status, {
        code: "drill_unavailable",
        message: "This drill-down isn't available from the engine yet.",
        hint: "Your numbers on the previous page are real; restart the engine to pick up drill-downs, then try again.",
      });
    }
    throw e;
  }
}
