/**
 * In-browser mock of the engine API (NEXT_PUBLIC_API_MODE=mock).
 * Mirrors HTTP semantics (status + JSON body) so the client code path is the same.
 */
import type { ChatMessage, Goals, Job, ProfileResponse, StoredProfile, ToolId } from "@/lib/types";
import { TOOLS } from "@/lib/tools";
import { mockChat } from "./chat";
import { ANJALI, ANJALI_GOALS, RIYA, RIYA_GOALS } from "./profiles";
import { buildResult, JOB_STEPS } from "./results";
import { FEATURES } from "@/features/registry";

type Out = { status: number; body: unknown };
const DB_KEY = "afterdegree.mock.db";
const STEP_MS = 420;

interface Db {
  profiles: Record<string, StoredProfile>;
}

function load(): Db {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* fall through */
  }
  return { profiles: {} };
}
function save(db: Db) {
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage blocked */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const err = (status: number, code: string, message: string, hint?: string): Out => ({
  status,
  body: { error: { code, message, hint } },
});

const LINKEDIN_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?(\?.*)?$/i;

function initialGoals(p: ProfileResponse): Goals {
  return p.derived.persona_guess === "university"
    ? { ...ANJALI_GOALS, programs: [], institution: p.derived.current_company }
    : { ...RIYA_GOALS, intent: null, target_roles: [], target_countries: [], target_cities: [] };
}

interface MockJob {
  job: Job;
  started: number;
  instant: boolean;
  params: Record<string, unknown>;
  profileId: string;
}
const jobs = new Map<string, MockJob>();
const seen = new Set<string>();
let seq = 0;

function getStored(id: unknown): StoredProfile | null {
  if (typeof id !== "string") return null;
  return load().profiles[id] ?? null;
}

/** Profiles that exist only in mock mode, so a stored id from an older session keeps working. */
function fallbackProfile(id: string): StoredProfile {
  const base = id.includes("anjali") ? ANJALI : RIYA;
  return { ...base, profile_id: id, goals: id.includes("anjali") ? ANJALI_GOALS : RIYA_GOALS };
}

/** Demo switch for thin states: a narrow experience band (upper bound of 1 year or less), or `?thin=1` on the page URL. */
function isNarrow(params: Record<string, unknown>): boolean {
  const band = params.exp_band;
  const nums = Array.isArray(band) ? band.map(Number) : typeof band === "string" ? band.split(",").map(Number) : [];
  if (nums.length === 2 && nums.every((x) => Number.isFinite(x)) && Math.max(...nums) <= 1) return true;
  try {
    return new URLSearchParams(window.location.search).get("thin") === "1";
  } catch {
    return false;
  }
}

export async function mockRequest(method: string, path: string, body?: unknown): Promise<Out> {
  const b = (body ?? {}) as Record<string, unknown>;

  if (method === "POST" && path === "/onboarding/profile") {
    await wait(2600);
    const url = String(b.linkedin_url ?? "").trim();
    const m = LINKEDIN_RE.exec(url);
    if (!m) {
      return err(400, "invalid_url", "That doesn't look like a LinkedIn profile link.", "It should look like https://www.linkedin.com/in/your-name");
    }
    const slug = m[2].toLowerCase();
    if (slug.includes("notfound") || slug.includes("missing")) {
      return err(404, "profile_not_found", "We couldn't find a public profile at that link.", "Open your LinkedIn profile, copy the address from the browser bar, and paste it here.");
    }
    const base = /anjali|career|placement|university|registrar/.test(slug) ? ANJALI : RIYA;
    const profile_id = `p_${base === ANJALI ? "anjali" : "riya"}_${Date.now().toString(36)}`;
    const resp: ProfileResponse = { ...base, profile_id };
    const db = load();
    db.profiles[profile_id] = { ...resp, goals: null };
    save(db);
    return { status: 200, body: resp };
  }

  if (method === "POST" && path === "/onboarding/chat") {
    await wait(700);
    const p = getStored(b.profile_id);
    if (!p) return err(404, "profile_not_found", "We lost track of your profile.", "Start again by pasting your LinkedIn link.");
    return { status: 200, body: mockChat(p, (b.messages as ChatMessage[]) ?? [], initialGoals(p)) };
  }

  if (method === "POST" && path === "/onboarding/complete") {
    await wait(500);
    const db = load();
    const id = String(b.profile_id);
    const p = db.profiles[id];
    if (!p) return err(404, "profile_not_found", "We lost track of your profile.", "Start again by pasting your LinkedIn link.");
    p.goals = b.goals as Goals;
    save(db);
    const country = p.goals.target_countries[0] ?? "Germany";
    return {
      status: 200,
      body: { profile_id: id, home: { next_steps: [{ label: `See your Internship-to-Job chances in ${country}`, tool: "internship_chances", params: { country } }] } },
    };
  }

  let m: RegExpExecArray | null;
  if (method === "GET" && (m = /^\/profiles\/([^/]+)$/.exec(path))) {
    await wait(150);
    const p = getStored(m[1]) ?? fallbackProfile(m[1]);
    return { status: 200, body: p };
  }

  if (method === "POST" && (m = /^\/tools\/([a-z-]+)$/.exec(path))) {
    const def = TOOLS.find((t) => t.slug === m![1]);
    if (!def) return err(404, "unknown_tool", "That tool doesn't exist.");
    const missing = def.fields.filter((f) => f.required && !String(b[f.name] ?? "").trim());
    if (missing.length) {
      return err(400, "missing_param", `Please add ${missing.map((f) => f.label.toLowerCase()).join(" and ")}.`, "Fill in the highlighted fields and run it again.");
    }
    await wait(200);
    const { profile_id, ...params } = b;
    const key = `${def.id}:${String(profile_id)}:${JSON.stringify(params)}`;
    const job_id = `job_${(++seq).toString(36)}_${Date.now().toString(36)}`;
    const steps = JOB_STEPS[def.id];
    jobs.set(job_id, {
      job: { job_id, tool: def.id, status: "queued", progress: { step: steps[0], done: 0, total: steps.length } },
      started: Date.now(),
      instant: seen.has(key),
      params,
      profileId: String(profile_id),
    });
    seen.add(key);
    return { status: 200, body: { job_id } };
  }

  if (method === "GET" && (m = /^\/jobs\/([^/]+)$/.exec(path))) {
    await wait(60);
    const mj = jobs.get(m[1]);
    if (!mj) return err(404, "job_not_found", "That run has expired.", "Run the tool again.");
    const steps = JOB_STEPS[mj.job.tool as ToolId];
    const done = mj.instant ? steps.length : Math.min(steps.length, Math.floor((Date.now() - mj.started) / STEP_MS));
    if (done >= steps.length) {
      const p = getStored(mj.profileId) ?? fallbackProfile(mj.profileId);
      const goals = p.goals ?? initialGoals(p);
      const ctx = { goals, params: mj.params, university: goals.persona === "university" };
      const slug = TOOLS.find((t) => t.id === mj.job.tool)!.slug;
      const feature = FEATURES[slug];
      const own = isNarrow(mj.params) && feature?.mockResultThin ? feature.mockResultThin : feature?.mockResult;
      const result = own ? (typeof own === "function" ? own(ctx) : own) : buildResult(mj.job.tool, ctx);
      return { status: 200, body: { ...mj.job, status: "done", progress: { step: "Done", done: steps.length, total: steps.length }, result } };
    }
    return { status: 200, body: { ...mj.job, status: done === 0 ? "queued" : "running", progress: { step: steps[done], done, total: steps.length } } };
  }

  if (method === "GET" && (m = /^\/evidence\/([^/]+)$/.exec(path))) {
    return err(404, "evidence_not_found", "Evidence details are included with each result in mock mode.");
  }

  if (method === "GET" && path === "/health") {
    return { status: 200, body: { crustdata: "ok", llm: "ok" } };
  }

  return err(404, "not_found", `No mock for ${method} ${path}.`);
}
