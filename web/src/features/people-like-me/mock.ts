import { makeCount as count } from "@/lib/count";
import type { DrillStep, DrillToken } from "@/lib/drill-types";
import type { Cohort, Evidence, MatchLevel, ResultEnvelope, Section } from "@/lib/types";
import type { MockContext } from "../types";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T09:52:00Z";
const EXAMPLE = "Example data (mock mode)";

const filters = {
  degree: "BTech",
  field: "Computer Science",
  school: "VIT Vellore",
  graduation_years: [2020, 2024],
  exp_band: [1, 3],
};

const evidence: Evidence[] = [
  {
    id: "ev_plm_search",
    endpoint: "/person/search",
    filters,
    total_count: 312,
    results_used: 200,
    fetched_at: FETCHED,
    source: "mock",
    note: "Sampled the first 200 of 312 matching profiles (example data)",
  },
  {
    id: "ev_plm_degrees",
    endpoint: "/person/search",
    filters: { ...filters, has_postgrad: true },
    total_count: 135,
    results_used: 135,
    fetched_at: FETCHED,
    source: "mock",
    note: "Profiles in the cohort that list a further degree (example data)",
  },
];

const cohort: Cohort = {
  definition: "BTech CSE graduates of VIT Vellore (2020–2024) with 1–3 years of work",
  filters,
  n_visible: 312,
  match_level: "exact_school",
  widened: false,
  widened_reason: null,
};

/** Drill token the engine would attach: the tool, the exact params of this run, and the path so far. */
function token(params: Record<string, unknown>, path: DrillStep[]): DrillToken {
  return { tool: "people_like_me", params, path };
}
const step = (dimension: DrillStep["dimension"], value: string, label = value): DrillStep => ({ dimension, value, label });
const withDrill = <T extends object>(item: T, drill: DrillToken): T => ({ ...item, drill });

/** Attach realistic drill tokens to every drillable row (never to folded "Other" rows or remainders). */
function addDrills(list: Section[], params: Record<string, unknown>): Section[] {
  const country = step("country", "Germany");
  return list.map((sec): Section => {
    if (sec.kind === "distribution") {
      const dimension = sec.id === "countries" ? "country" : sec.id === "degree_countries" ? "degree_country" : sec.id === "further_degrees" ? "degree" : null;
      if (!dimension) return sec;
      const items = sec.data.items.map((i) =>
        i.remainder || /^(other|abroad|took a further)/i.test(i.label) ? i : withDrill(i, token(params, [step(dimension, i.label)])),
      );
      return { ...sec, data: { ...sec.data, items } };
    }
    if (sec.kind === "ranked_table") {
      const key = sec.id === "roles" ? "role" : sec.id === "employers_target" ? "company" : null;
      if (!key) return sec;
      const col = key === "role" ? "role" : "employer";
      const rows = sec.data.rows.map((r) =>
        r.rest ? r : withDrill(r, token(params, [...(key === "company" ? [country] : []), step(key, String(r.cells[col]))])),
      );
      return { ...sec, data: { ...sec.data, rows } };
    }
    return sec;
  });
}

const rawSections: Section[] = [
  {
    id: "cohort_size",
    kind: "stat",
    title: "People like you",
    data: { label: "visible profiles", value: 312 },
    evidence_ids: ["ev_plm_search"],
  },
  {
    id: "countries",
    kind: "distribution",
    title: "Where the 312 are now",
    data: {
      n: 312,
      unit: "people",
      caption: "Each square is one person like you. Abroad first; your target is highlighted.",
      items: [
        { label: "Germany", count: 71, share: 71 / 312, target: true },
        { label: "United States", count: 58, share: 58 / 312 },
        { label: "United Kingdom", count: 34, share: 34 / 312 },
        { label: "Canada", count: 27, share: 27 / 312 },
        { label: "Netherlands", count: 15, share: 15 / 312 },
        { label: "Other countries", count: 9, share: 9 / 312 },
        { label: "Still in India", count: 98, share: 98 / 312, remainder: true },
      ],
    },
    evidence_ids: ["ev_plm_search"],
  },
  {
    id: "roles",
    kind: "ranked_table",
    title: "What they do now",
    data: {
      n: 214,
      caption: "abroad",
      columns: [
        { key: "role", label: "Role", type: "text" },
        { key: "people", label: "People", type: "int", bar: true },
      ],
      rows: [
        { cells: { role: "Data Engineer", people: 38 }, you: true },
        { cells: { role: "Data Scientist", people: 31 } },
        { cells: { role: "Software Engineer", people: 29 } },
        { cells: { role: "Data Analyst", people: 22 } },
        { cells: { role: "ML Engineer", people: 14 } },
        { cells: { role: "Other roles", people: 80 }, rest: true },
      ],
    },
    evidence_ids: ["ev_plm_search"],
  },
  {
    id: "employers_target",
    kind: "ranked_table",
    title: "Employers in Germany",
    data: {
      n: 71,
      columns: [
        { key: "employer", label: "Employer", type: "text" },
        { key: "people", label: "People", type: "int", bar: true },
      ],
      rows: [
        { cells: { employer: "SAP", people: 9 } },
        { cells: { employer: "Zalando", people: 7 } },
        { cells: { employer: "Siemens", people: 6 } },
        { cells: { employer: "Delivery Hero", people: 5 } },
        { cells: { employer: "At other employers", people: 44 }, rest: true },
      ],
    },
    evidence_ids: ["ev_plm_search"],
  },
  {
    id: "further_degrees",
    kind: "distribution",
    title: "Further degrees",
    data: {
      n: 312,
      unit: "degrees",
      caption: "A master's is by far the most common step. Most of the rest show no further degree on their profile.",
      items: [
        { label: "MS / MSc", count: 121, share: 121 / 312 },
        { label: "MBA", count: 8, share: 8 / 312 },
        { label: "PhD", count: 6, share: 6 / 312 },
        { label: "No further degree shown", count: 177, share: 177 / 312, remainder: true },
      ],
    },
    evidence_ids: ["ev_plm_degrees"],
  },
  {
    id: "degree_countries",
    kind: "distribution",
    title: "Where they studied",
    data: {
      n: 121,
      unit: "people",
      caption: "Country of the master's, for the 121 who took one.",
      items: [
        { label: "Germany", count: 46, share: 46 / 121, target: true },
        { label: "United States", count: 38, share: 38 / 121 },
        { label: "United Kingdom", count: 21, share: 21 / 121 },
        { label: "Canada", count: 9, share: 9 / 121 },
        { label: "Other countries", count: 7, share: 7 / 121 },
      ],
    },
    evidence_ids: ["ev_plm_degrees"],
  },
  {
    id: "moved_abroad",
    kind: "stat",
    title: "Moved abroad",
    data: {
      label: "of people like you now work outside India",
      count: count(214, 312, ["ev_plm_search"]),
    },
    evidence_ids: ["ev_plm_search"],
  },
];

const sections = addDrills(rawSections, { match: "exact_school", exp_band: [1, 3] });

/** Riya Menon, exact school, 1 to 3 years: a full, high-confidence cohort. */
const baseResult: ResultEnvelope = {
  tool: "people_like_me",
  title: "Where people like you are now",
  summary:
    "Of the 312 people with your background we can see, at least 214 now work outside India. Germany is the most common destination, and most of them did a master's there first. A data role is the most common thing they do now.",
  cohort,
  confidence: "high",
  coverage_note:
    "Based on 312 visible profiles; 81% show a current country, so every count is “at least”. People without public profiles are not counted.",
  data_date: DATA_DATE,
  sections,
  next_steps: [
    {
      label: "See your Internship-to-Job chances in Germany",
      tool: "internship_chances",
      params: { country: "Germany", role: "Data Engineer" },
    },
  ],
  warnings: [EXAMPLE],
  evidence,
};

/* ------------------------------------------------------------------ */
/* Variants: match level, experience band and the university lens       */
/* ------------------------------------------------------------------ */

const SCALE: Record<MatchLevel, number> = { exact_school: 1, school_tier: 486 / 312, field_only: 1920 / 312 };
const TIER_DEFINITION: Record<MatchLevel, string> = {
  exact_school: "BTech CSE graduates of VIT Vellore (2020–2024)",
  school_tier: "BTech CSE graduates of private tier-1 colleges (2020–2024)",
  field_only: "BTech CSE graduates of any Indian college (2020–2024)",
};

function bandFrom(v: unknown): [number, number] {
  const parts = Array.isArray(v) ? v.map(Number) : typeof v === "string" ? v.split(",").map(Number) : [];
  return parts.length === 2 && parts.every((x) => Number.isFinite(x)) ? [parts[0], parts[1]] : [1, 3];
}

const bandWords = (b: [number, number]) => (b[1] <= 1 ? "under 1 year of work" : `${b[0]}–${b[1]} years of work`);

/** Scale a section's counts by k, keeping each section's own total consistent. */
function scaleSection(sec: Section, k: number): Section {
  const sc = (x: number) => Math.max(1, Math.round(x * k));
  if (sec.kind === "distribution") {
    const items = sec.data.items.map((i) => ({ ...i, count: sc(i.count) }));
    const n = items.reduce((a, i) => a + i.count, 0);
    const title = sec.title.replace(/\b\d[\d,]*\b/, String(n));
    return { ...sec, title, data: { ...sec.data, n, items: items.map((i) => ({ ...i, share: i.count / n })) } };
  }
  if (sec.kind === "ranked_table") {
    const total = sc(sec.data.n ?? 0);
    const rows = sec.data.rows.map((r) => {
      const cells = { ...r.cells };
      if (!r.rest) cells.people = sc(Number(cells.people));
      return { ...r, cells };
    });
    const named = rows.filter((r) => !r.rest).reduce((a, r) => a + Number(r.cells.people), 0);
    for (const r of rows) if (r.rest) r.cells.people = Math.max(1, total - named);
    return { ...sec, data: { ...sec.data, n: named + rows.filter((r) => r.rest).reduce((a, r) => a + Number(r.cells.people), 0), rows } };
  }
  if (sec.kind === "stat") {
    if (sec.data.count) return { ...sec, data: { ...sec.data, count: count(sc(sec.data.count.k), sc(sec.data.count.n), sec.data.count.evidence_ids) } };
    if (typeof sec.data.value === "number") return { ...sec, data: { ...sec.data, value: sc(sec.data.value) } };
  }
  return sec;
}

const untarget = <T extends { target?: boolean }>(i: T): T => ({ ...i, target: false });

/** Reword the student result for the university lens: "your graduates", no personal target, program-level next step. */
function universityLens(r: ResultEnvelope): ResultEnvelope {
  const countries = r.sections.find((x) => x.id === "countries");
  const n = countries?.kind === "distribution" ? countries.data.n : r.cohort?.n_visible ?? 0;
  const abroad = countries?.kind === "distribution" ? countries.data.items.filter((i) => !i.remainder).reduce((a, i) => a + i.count, 0) : 0;
  const sections = r.sections.map((sec): Section => {
    if (sec.id === "cohort_size" && sec.kind === "stat") return { ...sec, title: "Your graduates" };
    if (sec.id === "moved_abroad" && sec.kind === "stat") return { ...sec, data: { ...sec.data, label: "of your graduates now work outside India" } };
    if (sec.id === "countries" && sec.kind === "distribution") {
      return {
        ...sec,
        title: `Where your ${n} graduates are now`,
        data: { ...sec.data, caption: "Each square is one graduate. Abroad first.", items: sec.data.items.map(untarget) },
      };
    }
    if (sec.id === "roles" && sec.kind === "ranked_table") {
      return { ...sec, data: { ...sec.data, rows: sec.data.rows.map((row) => ({ ...row, you: false })) } };
    }
    if (sec.id === "employers_target" && sec.kind === "ranked_table") return { ...sec, title: "Employers in Germany" };
    if (sec.id === "degree_countries" && sec.kind === "distribution") {
      return { ...sec, data: { ...sec.data, items: sec.data.items.map(untarget) } };
    }
    return sec;
  });
  return {
    ...r,
    title: "Where your graduates are now",
    summary: `Of the ${n} graduates of your programs we can see, at least ${abroad} now work outside India. Germany and the United States are the most common destinations, and most of those who left took a master's first. A data role is the most common thing they do now.`,
    cohort: r.cohort && { ...r.cohort, definition: r.cohort.definition.replace(/^BTech CSE graduates of VIT Vellore/, "Your BTech CSE graduates (VIT Vellore)").replace(/ with .*$/, "") },
    sections,
    next_steps: [
      {
        label: "See which programs feed Data Engineer roles in Germany",
        tool: "routes_to_position",
        params: { role: "Data Engineer", country: "Germany" },
      },
    ],
  };
}

/** Honours `match` and `exp_band` from the run, and the university lens. */
export function mockResult(ctx: MockContext): ResultEnvelope {
  const match = (typeof ctx.params.match === "string" && ctx.params.match in SCALE ? ctx.params.match : "exact_school") as MatchLevel;
  const band = bandFrom(ctx.params.exp_band);
  const k = SCALE[match];
  let r = baseResult;
  if (match !== "exact_school" || band[0] !== 1 || band[1] !== 3) {
    const sections = addDrills(r.sections.map((sec) => scaleSection(sec, k)), { match, exp_band: band });
    const countries = sections.find((x) => x.id === "countries");
    const dist = countries?.kind === "distribution" ? countries.data : null;
    const n = dist?.n ?? r.cohort!.n_visible;
    const abroad = dist ? dist.items.filter((i) => !i.remainder).reduce((a, i) => a + i.count, 0) : 0;
    const f = { ...filters, exp_band: band, ...(match === "exact_school" ? {} : { school: match }) };
    r = {
      ...r,
      sections,
      cohort: { ...r.cohort!, definition: `${TIER_DEFINITION[match]} with ${bandWords(band)}`, filters: f, n_visible: n, match_level: match },
      evidence: r.evidence.map((e) => ({
        ...e,
        filters: { ...e.filters, ...f },
        total_count: Math.round(e.total_count * k),
        results_used: Math.min(200, Math.round(e.total_count * k)),
      })),
      summary: r.summary ? r.summary.replace(/\b312\b/, String(n)).replace(/at least \d+/, `at least ${abroad}`) : null,
      coverage_note: r.coverage_note?.replace(/\b312\b/, String(n)),
    };
  }
  return ctx.university ? universityLens(r) : r;
}

/** A band this narrow leaves too few people: widened to similar colleges, still thin. */
const thinFilters = { ...filters, school: "VIT Vellore (widened to private tier-1)", exp_band: [0, 1] };

export const mockResultThin: ResultEnvelope = {
  tool: "people_like_me",
  title: "Where people like you are now",
  summary:
    "Only a handful of people match a band this narrow, even after we added similar colleges, so treat this as a few stories rather than odds. Widening the years of experience will give you a fairer picture.",
  cohort: {
    definition: "BTech CSE graduates of private tier-1 colleges (2020–2024) with under 1 year of work",
    filters: thinFilters,
    n_visible: 8,
    match_level: "school_tier",
    widened: true,
    widened_reason:
      "Only 3 people from VIT Vellore had under a year of work, so we also included similar colleges. It is still a small group.",
  },
  confidence: "low",
  coverage_note:
    "Based on 8 visible profiles; people without public profiles are not counted. Groups smaller than 5 are not broken out.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "cohort_size",
      kind: "stat",
      title: "People like you",
      data: { label: "visible profiles", value: 8 },
      evidence_ids: ["ev_plm_search_thin"],
    },
    {
      id: "countries",
      kind: "distribution",
      title: "Where the 8 are now",
      data: {
        n: 8,
        unit: "people",
        caption: "Countries with fewer than 5 people are not broken out, so abroad is shown as one group.",
        items: [
          { label: "Abroad, all countries", count: 5, share: null },
          { label: "Still in India", count: 3, share: null, remainder: true },
        ],
      },
      evidence_ids: ["ev_plm_search_thin"],
    },
    {
      id: "roles",
      kind: "ranked_table",
      title: "What they do now",
      data: {
        n: 5,
        caption: "abroad",
        columns: [
          { key: "role", label: "Role", type: "text" },
          { key: "people", label: "People", type: "int" },
        ],
        rows: [{ cells: { role: "Roles with fewer than 5 people each", people: 5 }, rest: true }],
      },
      evidence_ids: ["ev_plm_search_thin"],
    },
    {
      id: "employers_target",
      kind: "ranked_table",
      title: "Employers in Germany",
      data: {
        n: 2,
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "people", label: "People", type: "int" },
        ],
        rows: [{ cells: { employer: "Employers with fewer than 5 people each", people: 2 }, rest: true }],
      },
      evidence_ids: ["ev_plm_search_thin"],
    },
    {
      id: "further_degrees",
      kind: "distribution",
      title: "Further degrees",
      data: {
        n: 8,
        unit: "degrees",
        caption: "Too few to say which degrees are common. 3 of 8 show a further degree.",
        items: [
          { label: "Took a further degree", count: 3, share: null },
          { label: "No further degree shown", count: 5, share: null, remainder: true },
        ],
      },
      evidence_ids: ["ev_plm_search_thin"],
    },
    {
      id: "moved_abroad",
      kind: "stat",
      title: "Moved abroad",
      data: {
        label: "of people like you now work outside India",
        count: count(5, 8, ["ev_plm_search_thin"]),
      },
      evidence_ids: ["ev_plm_search_thin"],
    },
  ],
  next_steps: [
    {
      label: "Widen to 1 to 3 years of work",
      tool: "people_like_me",
      params: { match: "school_tier", exp_band: [1, 3] },
    },
  ],
  warnings: [
    EXAMPLE,
    "Fewer than 10 people match. We show counts as they are and hide shares, because a percentage from this few people would mislead.",
  ],
  evidence: [
    {
      id: "ev_plm_search_thin",
      endpoint: "/person/search",
      filters: thinFilters,
      total_count: 8,
      results_used: 8,
      fetched_at: FETCHED,
      source: "mock",
      note: "All 8 matching profiles were read (example data)",
    },
  ],
};
