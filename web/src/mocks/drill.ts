/**
 * Mock engine for drill-downs: POST /drill (job), GET /jobs/djob_*, GET /people/{id}.
 * Called first by mocks/server.ts; returns null for any other route.
 */
import type {
  DrillContext,
  DrillResultFull,
  DrillStep,
  DrillToken,
  PersonCard,
  PersonDetailFull,
  PersonStep,
} from "@/lib/drill-types";
import type { Evidence, Section } from "@/lib/types";
import { makeCount } from "@/lib/count";
import { TOOLS } from "@/lib/tools";
import {
  apportion,
  b64url,
  COUNTRY_WEIGHTS,
  entriesFor,
  entriesForCompany,
  extend,
  FILTER_WIDEN,
  getParam,
  hash,
  INDIA_EMPLOYERS,
  KNOWN_COUNTRIES,
  MASTERS,
  ORIGIN_N,
  ROLE_WEIGHTS,
  rng,
  SKILLS_BY_ROLE,
  step,
  unb64url,
  type Entry,
} from "./drill-data";
import { companyProfile } from "./drill-company";

type Out = { status: number; body: unknown };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DATE = "2026-11-06";
const STEP_MS = 380;
const PAGE = 12;

/* ---------- context ---------- */

const toolLabel = (tool: string) => TOOLS.find((t) => t.id === tool)?.short ?? tool.replace(/_/g, " ");

const MATCH_LABEL: Record<string, string> = {
  exact_school: "same college and field",
  school_tier: "similar colleges, same field",
  field_only: "same field, any college",
};

function bandText(v: unknown): string | null {
  const nums = Array.isArray(v) ? v.map(Number) : typeof v === "string" ? v.split(",").map(Number) : [];
  return nums.length === 2 && nums.every(Number.isFinite) ? `${nums[0]}–${nums[1]} yrs` : null;
}

export function contextFor(token: DrillToken): DrillContext {
  const p = token.params;
  const f: DrillContext["filters"] = [];
  const str = (k: string) => {
    const v = getParam(p, k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const role = str("scope.role");
  if (token.tool === "conversion_map" && role) {
    f.push({ label: "Interns and working students", value: `${role.toLowerCase()} roles`, param: "scope.role" });
  } else if (role ?? str("role")) {
    f.push({ label: "Role", value: (role ?? str("role"))!, param: role ? "scope.role" : "role" });
  }
  const company = str("scope.company") ?? str("company");
  if (company) f.push({ label: "Company", value: company, param: str("scope.company") ? "scope.company" : "company" });
  const school = str("scope.school") ?? str("school");
  if (school) f.push({ label: "College", value: school, param: str("scope.school") ? "scope.school" : "school" });
  const match = str("match");
  if (match && MATCH_LABEL[match]) f.push({ label: "Like you", value: MATCH_LABEL[match], param: "match" });
  const band = bandText(p.exp_band);
  if (band) f.push({ label: "Experience", value: band, param: "exp_band" });
  const country = str("country") ?? str("scope.country");
  if (country && !token.path.some((s) => s.dimension === "country")) {
    f.push({ label: "Country", value: country, param: str("country") ? "country" : "scope.country" });
  }
  return { origin_tool: token.tool, origin_label: toolLabel(token.tool), filters: f };
}

/** Origin cohort size: the full-filter size, widened for every filter the user dropped. */
function originN(token: DrillToken): number {
  const base = ORIGIN_N[token.tool] ?? ORIGIN_N.default;
  const defaults: Record<string, string[]> = {
    conversion_map: ["scope.company", "scope.school", "exp_band", "scope.role"],
    people_like_me: ["match", "exp_band"],
  };
  const keys = defaults[token.tool] ?? [];
  let n = base;
  for (const k of keys) if (getParam(token.params, k) === undefined) n *= FILTER_WIDEN[k] ?? 1.5;
  return Math.round(n);
}

function noun(token: DrillToken): string {
  const company = getParam(token.params, "scope.company") ?? getParam(token.params, "company");
  if (token.tool === "conversion_map") return company ? `${String(company)} interns like you` : "interns like you";
  return "people like you";
}

/* ---------- slicing ---------- */

interface Slice {
  n: number;
  /** Joint (city x company) entries with counts, filtered to the path. */
  entries: (Entry & { count: number })[];
  country?: string;
  city?: string;
  company?: string;
  role?: string;
  /** Parent count (the n of the level above), for "of N". */
  parentN: number;
}

function countryCounts(token: DrillToken, n0: number): [string, number][] {
  return apportion(n0, COUNTRY_WEIGHTS[token.tool] ?? COUNTRY_WEIGHTS.default);
}

function sliceFor(token: DrillToken): Slice {
  const n0 = originN(token);
  let n = n0;
  let parentN = n0;
  type Counted = Entry & { count: number };
  let entries: Counted[] | null = null;
  const s: Partial<Slice> = {};
  const ensureAll = (): (Entry & { count: number })[] =>
    countryCounts(token, n0).flatMap(([c, cn]) =>
      apportion(cn, entriesFor(c).map((e) => [e, e.w] as [Entry, number])).map(([e, count]) => ({ ...e, count })),
    );

  for (const st of token.path) {
    parentN = n;
    if (st.dimension === "country") {
      s.country = st.value;
      const cn = countryCounts(token, n0).find(([c]) => c === st.value)?.[1] ?? Math.round(n * 0.25);
      entries = apportion(cn, entriesFor(st.value).map((e) => [e, e.w] as [Entry, number])).map(([e, count]) => ({ ...e, count }));
      n = cn;
    } else if (st.dimension === "city") {
      s.city = st.value;
      entries = (entries ?? ensureAll()).filter((e) => e.city === st.value);
      n = entries.reduce((a, e) => a + e.count, 0) || Math.round(n * 0.3);
    } else if (st.dimension === "company" || st.dimension === "posting_employer") {
      s.company = st.value;
      const pool: Counted[] = entries ?? ensureAll();
      const hit: Counted[] = pool.filter((e) => e.company === st.value);
      entries = hit.length ? hit : entriesForCompany(st.value).map((e) => ({ ...e, count: Math.max(1, Math.round(n * 0.04)) }));
      n = hit.length ? hit.reduce((a, e) => a + e.count, 0) : Math.max(3, Math.round(n * 0.12));
    } else if (st.dimension === "role") {
      s.role = st.value;
      const rc = apportion(n, ROLE_WEIGHTS).find(([r]) => r === st.value)?.[1] ?? Math.round(n * 0.3);
      if (entries) entries = scaleEntries(entries, rc);
      n = rc;
    } else {
      const k = Math.max(1, Math.round(n * 0.3));
      if (entries) entries = scaleEntries(entries, k);
      n = k;
    }
  }
  return { ...s, n, parentN, entries: (entries ?? ensureAll()).filter((e) => e.count > 0) };
}

function scaleEntries(entries: (Entry & { count: number })[], n: number) {
  return apportion(n, entries.map((e) => [e, e.count] as [Entry & { count: number }, number])).map(([e, count]) => ({ ...e, count }));
}

function group(entries: (Entry & { count: number })[], key: "city" | "company" | "country", foldUnder = 0) {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e[key], (m.get(e[key]) ?? 0) + e.count);
  let rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (foldUnder > 0) {
    const small = rows.filter(([, c]) => c < foldUnder);
    if (small.length > 1) {
      rows = rows.filter(([, c]) => c >= foldUnder);
      rows.push(["Elsewhere", small.reduce((a, [, c]) => a + c, 0)]);
    }
  }
  return rows.filter(([, c]) => c > 0);
}

/* ---------- people ---------- */

interface PersonSeed {
  s: number; // seed
  ci: string; // city
  co: string; // country
  cm: string; // company
  r: string; // role
  t: string; // origin tool
  sc: string; // school
  ic: string | null; // internship company
  n: number; // slice n
}

const encodeId = (p: PersonSeed) => `pp_${b64url(JSON.stringify(p))}`;
function decodeId(id: string): PersonSeed | null {
  if (!id.startsWith("pp_")) return null;
  try {
    return JSON.parse(unb64url(id.slice(3))) as PersonSeed;
  } catch {
    return null;
  }
}

function buildSteps(p: PersonSeed): PersonStep[] {
  const r = rng(p.s);
  const start = 2017 + Math.floor(r() * 3);
  const end = start + 4;
  const steps: PersonStep[] = [
    { kind: "education", org: p.sc, title: "BTech, Computer Science", city: p.sc.includes("VIT") ? "Vellore" : "India", country: "India", start_year: start, end_year: end, years: 4 },
  ];
  const [emp, title, city] = INDIA_EMPLOYERS[Math.floor(r() * INDIA_EMPLOYERS.length)];
  const workYears = 1 + Math.floor(r() * 2);
  if (p.co === "India" || p.co === "Still in India") {
    const cur = p.cm === "Elsewhere" ? emp : p.cm;
    steps.push({ kind: "internship", org: cur, title: `${p.r} Intern`, city: p.ci, country: "India", start_year: end, end_year: end, years: 0.5 });
    steps.push({ kind: "work", org: cur, title: p.r, city: p.ci === "Elsewhere" ? city : p.ci, country: "India", start_year: end, end_year: null, years: 2026 - end });
    return steps;
  }
  steps.push({ kind: "work", org: emp, title, city, country: "India", start_year: end, end_year: end + workYears, years: workYears });
  const ms = MASTERS[p.co] ?? [["a university abroad", "Master's", p.ci]];
  const [school, degree, msCity] = ms[Math.floor(r() * ms.length)];
  const msStart = end + workYears;
  steps.push({ kind: "education", org: school, title: degree, city: msCity, country: p.co, start_year: msStart, end_year: msStart + 2, years: 2 });
  const intern = p.ic ?? (r() > 0.4 ? p.cm : null);
  if (intern && intern !== "Elsewhere") {
    const iCity = intern === "SAP" ? "Walldorf" : p.ci;
    steps.push({ kind: "internship", org: intern, title: `Working Student, ${p.r.startsWith("Data") ? "Data Platform" : "Engineering"}`, city: iCity, country: p.co, start_year: msStart + 1, end_year: msStart + 2, years: 1 });
  }
  const company = p.cm === "Elsewhere" ? "a mid-size company" : p.cm;
  steps.push({ kind: "work", org: company, title: p.r, city: p.ci === "Elsewhere" ? msCity : p.ci, country: p.co, start_year: msStart + 2, end_year: null, years: Math.max(0.5, 2026 - (msStart + 2)) });
  return steps;
}

function cardFor(p: PersonSeed): PersonCard {
  const steps = buildSteps(p);
  const cur = steps[steps.length - 1];
  const r = rng(p.s ^ 0x9e37);
  const abroad = steps.find((s) => s.country && s.country !== "India");
  const reasons = ["Same college", "Same field", "Similar experience"].filter((_, i) => i === 0 || r() > 0.35);
  const tags: string[] = [];
  if (abroad) tags.push(`Moved abroad ${abroad.start_year}`);
  if (steps.some((s) => s.kind === "internship") && abroad) tags.push("MS → working student → full-time");
  return {
    id: encodeId(p),
    headline: `${cur.title} · ${cur.org} · ${cur.city}`,
    current: { title: cur.title, company: cur.org, city: cur.city, country: cur.country, since_year: cur.start_year },
    match_reasons: reasons,
    tags,
    steps,
  };
}

function peopleFor(token: DrillToken, slice: Slice, count = PAGE): PersonCard[] {
  const school = String(getParam(token.params, "scope.school") ?? getParam(token.params, "school") ?? "VIT Vellore");
  const ic = token.tool === "conversion_map" ? String(getParam(token.params, "scope.company") ?? "") || null : null;
  const pool = slice.entries.flatMap((e) => Array.from({ length: e.count }, () => e));
  // Round-robin over groups so the first cards show the variety of the slice.
  const byGroup = slice.entries.map((e) => Array.from({ length: e.count }, () => e));
  const order: Entry[] = [];
  for (let i = 0; order.length < pool.length; i++) for (const g of byGroup) if (g[i]) order.push(g[i]);
  const base = hash(JSON.stringify([token.tool, token.params, token.path]));
  return order.slice(0, Math.min(count, slice.n)).map((e, i) =>
    cardFor({
      s: (base + i * 7919) >>> 0,
      ci: e.city,
      co: e.country,
      cm: e.company,
      r: slice.role ?? ROLE_WEIGHTS[i % ROLE_WEIGHTS.length][0],
      t: token.tool,
      sc: school,
      ic,
      n: slice.n,
    }),
  );
}

/* ---------- sections ---------- */

const ev = (id: string, endpoint: string, total: number, note: string): Evidence => ({
  id,
  endpoint,
  filters: {},
  total_count: total,
  results_used: Math.min(total, 200),
  fetched_at: `${DATE}T09:40:00Z`,
  source: "mock",
  note,
});

function rankedPeople(id: string, title: string, key: string, label: string, rows: [string, number][], token: DrillToken, dim: DrillStep["dimension"], caption?: string, preview?: (v: string) => { label: string; items: { label: string; count: number }[] }[]): Section {
  return {
    id,
    kind: "ranked_table",
    title,
    data: {
      n: rows.reduce((a, [, c]) => a + c, 0),
      caption,
      columns: [
        { key, label, type: "text" },
        { key: "people", label: "People", type: "int", bar: true },
      ],
      rows: rows.map(([v, c]) => ({
        id: v,
        cells: { [key]: v, people: c },
        rest: v === "Elsewhere" || undefined,
        ...(v === "Elsewhere" ? {} : { drill: extend(token, step(dim, v)) }),
        ...(preview && v !== "Elsewhere" ? { preview: preview(v) } : {}),
      })),
    },
  } as unknown as Section;
}

function roleRows(n: number): [string, number][] {
  return apportion(n, ROLE_WEIGHTS).filter(([, c]) => c > 0);
}

function sectionsFor(token: DrillToken, slice: Slice): Section[] {
  const last = token.path[token.path.length - 1];
  const out: Section[] = [];
  const where = slice.city ?? slice.country ?? "this group";
  if (!slice.city && slice.country) {
    const cityRows = group(slice.entries, "city");
    out.push(
      rankedPeople("cities", "Cities", "city", "City", cityRows, token, "city", `Where the ${slice.n} live now`, (city) => {
        const es = slice.entries.filter((e) => e.city === city);
        const n = es.reduce((a, e) => a + e.count, 0);
        return [
          { label: "Companies", items: group(es, "company").slice(0, 2).map(([label, count]) => ({ label, count })) },
          { label: "Roles", items: roleRows(n).slice(0, 2).map(([label, count]) => ({ label, count })) },
        ];
      }),
    );
  }
  if (!slice.company) {
    const compRows = group(slice.entries, "company", 2);
    const top = compRows[0];
    out.push(
      rankedPeople(
        "companies",
        "Companies",
        "company",
        "Company",
        compRows,
        token,
        "company",
        top ? `Where they work now. ${top[1]} work at ${top[0]}.` : "Where they work now",
        (company) => {
          const es = slice.entries.filter((e) => e.company === company);
          const n = es.reduce((a, e) => a + e.count, 0);
          return [
            { label: "Roles", items: roleRows(n).slice(0, 3).map(([label, count]) => ({ label, count })) },
            { label: "Cities", items: group(es, "city").slice(0, 3).map(([label, count]) => ({ label, count })) },
          ];
        },
      ),
    );
  }
  if (!slice.role) {
    out.push(rankedPeople("roles", "Roles", "role", "Role", roleRows(slice.n), token, "role", `What they do now in ${where}`));
  }
  if (last?.dimension === "role" || last?.dimension === "city") {
    const bands = apportion(slice.n, [["0–1 yrs", 2], ["1–3 yrs", 5], ["3–5 yrs", 3]] as [string, number][]);
    out.push({
      id: "years",
      kind: "distribution",
      title: "Years of work now",
      data: {
        n: slice.n,
        unit: "people",
        items: bands.map(([label, count]) => ({ label, count, drill: extend(token, step("years_band", label)) })),
      },
    } as unknown as Section);
  }
  return out;
}

/* ---------- results ---------- */

function titleFor(token: DrillToken, slice: Slice): string {
  const n = noun(token);
  const cap = n.charAt(0).toUpperCase() + n.slice(1);
  const last = token.path[token.path.length - 1];
  if (!last) return cap;
  if (last.dimension === "company") return `${cap} at ${last.label}`;
  if (last.dimension === "role") return `${cap} working as ${last.label}`;
  return `${cap} in ${slice.city ?? last.label}`;
}

function nextSteps(token: DrillToken, slice: Slice): DrillResultFull["next_steps"] {
  const company = slice.company ?? (getParam(token.params, "scope.company") as string | undefined);
  const country = slice.country && slice.country !== "Other countries" && slice.country !== "Still in India" ? slice.country : undefined;
  const steps: NonNullable<DrillResultFull["next_steps"]> = [];
  if (company && company !== "Elsewhere") steps.push({ label: `See your Internship-to-Job chances at ${company}`, tool: "internship_chances", params: { company, ...(country ? { country } : {}) } });
  if (country) steps.push({ label: `Indian-friendly companies in ${country}`, tool: "indian_friendly", params: { country, ...(slice.city ? { city: slice.city } : {}) } });
  if (slice.role && country) steps.push({ label: `Open ${slice.role} postings in ${country}`, tool: "job_postings", params: { role: slice.role, country } });
  if (!steps.length) steps.push({ label: "See the routes into your goal", tool: "reverse_gps", params: {} });
  return steps.slice(0, 2);
}

function summaryFor(token: DrillToken, slice: Slice, sections: Section[]): string {
  const comp = sections.find((s) => s.id === "companies");
  const cities = sections.find((s) => s.id === "cities");
  const topCity = cities?.kind === "ranked_table" ? String(cities.data.rows[0]?.cells.city ?? "") : "";
  const topCo = comp?.kind === "ranked_table" ? comp.data.rows[0] : null;
  const parts: string[] = [];
  if (slice.country && slice.country !== "India" && !slice.country.startsWith("Still")) parts.push(`Most of them did a master’s in ${slice.country} first and then found work there.`);
  if (topCo && token.tool === "conversion_map") parts.push(`${topCo.cells.people} stayed on at ${topCo.cells.company} full-time.`);
  else if (topCo) parts.push(`${topCo.cells.company} employs the most of them (${topCo.cells.people}).`);
  if (topCity) parts.push(`${topCity} holds the biggest group, so start there, or pick any city below.`);
  if (!parts.length) parts.push("Pick any group below to go one level deeper, or open a career path to see each step.");
  return parts.join(" ");
}

export function buildDrill(token: DrillToken): DrillResultFull {
  const slice = sliceFor(token);
  const blocked = slice.n < 5;
  const sections = blocked ? sectionsFor(token, slice).filter((s) => s.id !== "years") : sectionsFor(token, slice);
  const people = blocked ? [] : peopleFor(token, slice);
  const evidence = [
    ev("ev_drill_people", "/person/search", slice.n, "People matching your filters and this slice"),
    ev("ev_drill_origin", "/person/search", slice.parentN, "The cohort you came from"),
  ];
  const last = token.path[token.path.length - 1];
  const base: DrillResultFull = {
    tool: "drill",
    title: titleFor(token, slice),
    path: token.path,
    context: contextFor(token),
    count: makeCount(slice.n, slice.parentN, ["ev_drill_people"]),
    count_label: `${noun(token)}${token.path.length > 1 ? ` in ${token.path[token.path.length - 2].label}` : ""}`,
    cohort: {
      definition: `${noun(token)}${slice.country ? ` now in ${slice.city ?? slice.country}` : ""}`,
      filters: {},
      n_visible: slice.n,
      match_level: "exact_school",
      widened: false,
      widened_reason: null,
    },
    confidence: slice.n >= 20 ? "high" : slice.n >= 10 ? "medium" : "low",
    sections,
    people,
    people_total: slice.n,
    people_note: blocked ? undefined : `${people.length} of ${slice.n} shown, anonymised`,
    listing_blocked_reason: blocked ? "Fewer than 5 people match, so we don't list individuals." : null,
    warnings: slice.n < 10 && !blocked ? ["Under 10 people: read this as a hint, not a rate."] : [],
    evidence,
    summary: summaryFor(token, slice, sections),
    coverage: 0.81,
    data_date: DATE,
    next_steps: nextSteps(token, slice),
  };
  if (last?.dimension === "company" || last?.dimension === "posting_employer") {
    const { company, sections: cs, evidence: cev } = companyProfile(last.value, token, slice.n, slice.parentN, slice.entries);
    return { ...base, title: last.label, company, sections: cs, evidence: [...evidence, ...cev], summary: null } as DrillResultFull;
  }
  return base;
}

/* ---------- person detail ---------- */

export function personDetail(id: string): PersonDetailFull | null {
  const seed = decodeId(id);
  if (!seed) return null;
  const card = cardFor(seed);
  const role = seed.r;
  const skills = SKILLS_BY_ROLE[role] ?? SKILLS_BY_ROLE["Data Engineer"];
  const routeN = Math.max(5, Math.round(seed.n * 0.35));
  const r = rng(seed.s);
  const sameRoute: PersonCard[] = [1, 2, 3].map((k) =>
    cardFor({ ...seed, s: (seed.s + k * 104729) >>> 0, ci: [seed.ci, "Munich", "Hamburg"][k - 1] ?? seed.ci, cm: [seed.cm, "SAP", "Otto"][k - 1] ?? seed.cm, r: ["Data Engineer", "Data Analyst", "Data Engineer"][k - 1] }),
  );
  const ms = card.steps.find((s) => s.kind === "education" && s.country !== "India");
  const work = card.steps.find((s) => s.kind === "work" && s.country === "India");
  return {
    ...card,
    skills,
    route_stats: [
      { label: "took this route in the slice you came from", count: makeCount(routeN, seed.n) },
      { label: `went full-time where they interned`, count: makeCount(Math.max(1, routeN - 2), routeN) },
    ],
    route_typical_years: 2.5,
    route_skills: skills.slice(0, 6).map((term, i) => ({ term, count: Math.max(2, routeN - Math.floor(i * (0.6 + r() * 0.5))), n: routeN })),
    why: [
      { label: "College", value: seed.sc, note: "same" },
      { label: "Field", value: "Computer Science", note: "same" },
      ...(work && ms ? [{ label: "Work before the master's", value: `${work.years} yr${work.years === 1 ? "" : "s"}` }] : []),
    ],
    same_route: sameRoute,
    data_date: DATE,
  };
}

/* ---------- HTTP-ish handler ---------- */

interface DrillJobState {
  started: number;
  instant: boolean;
  token: DrillToken;
  steps: string[];
}
const jobs = new Map<string, DrillJobState>();
const seen = new Set<string>();
let seq = 0;

const err = (status: number, code: string, message: string, hint?: string): Out => ({ status, body: { error: { code, message, hint } } });

export async function mockDrillRequest(method: string, path: string, body?: unknown): Promise<Out | null> {
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpExecArray | null;

  if (method === "POST" && path === "/drill") {
    await wait(150);
    const token = b.drill as DrillToken | undefined;
    if (!token || typeof token.tool !== "string" || !Array.isArray(token.path)) {
      return err(400, "bad_input", "That link doesn't point at a group we can open.", "Go back and pick a count again.");
    }
    const key = JSON.stringify([token.tool, token.params, token.path]);
    const job_id = `djob_${(++seq).toString(36)}_${Date.now().toString(36)}`;
    const last = token.path[token.path.length - 1];
    const steps =
      last?.dimension === "company"
        ? ["Reading the cohort you came from", "Applying your filters", "Reading company facts", "Checking open postings", "Drawing anonymised paths"]
        : ["Reading the cohort you came from", "Applying your filters", "Counting the next level", "Drawing anonymised paths"];
    jobs.set(job_id, { started: Date.now(), instant: seen.has(key), token, steps });
    seen.add(key);
    return { status: 200, body: { job_id } };
  }

  if (method === "GET" && (m = /^\/jobs\/(djob_[^/?]+)$/.exec(path))) {
    await wait(50);
    const j = jobs.get(m[1]);
    if (!j) return err(404, "job_not_found", "That run has expired.", "Open the count again.");
    const done = j.instant ? j.steps.length : Math.min(j.steps.length, Math.floor((Date.now() - j.started) / STEP_MS));
    const base = { job_id: m[1], tool: "drill" };
    if (done >= j.steps.length) {
      return { status: 200, body: { ...base, status: "done", progress: { step: "Done", done, total: j.steps.length }, result: buildDrill(j.token) } };
    }
    return { status: 200, body: { ...base, status: done === 0 ? "queued" : "running", progress: { step: j.steps[done], done, total: j.steps.length } } };
  }

  if (method === "GET" && (m = /^\/people\/([^/?]+)(\?.*)?$/.exec(path))) {
    await wait(350);
    const detail = personDetail(decodeURIComponent(m[1]));
    if (!detail) return err(404, "person_not_found", "This career path is no longer available.", "Paths are kept for 7 days. Open the group again to see current paths.");
    return { status: 200, body: detail };
  }

  return null;
}

/** Example tokens for screens that want to link into a drill in mock mode. */
export const EXAMPLE_TOKENS = {
  germanyFromConversionMap: {
    tool: "conversion_map",
    params: { scope: { school: "VIT Vellore", role: "Data", company: "SAP" }, exp_band: [1, 3] },
    path: [step("country", "Germany")],
  } satisfies DrillToken,
  known: KNOWN_COUNTRIES,
};
