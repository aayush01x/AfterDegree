import type { Count, Evidence, ResultEnvelope, Section } from "@/lib/types";
import { mkDrill, withDrill } from "@/components/tool/drill";

/**
 * Example results for Riya Menon (BTech CSE, VIT Vellore 2022, 2 years at Infosys,
 * aiming for a data role in Germany). Everything here is made up for layout and
 * testing and is labelled as an example.
 */

const FETCHED = "2026-11-06T09:52:00Z";
const EX = "Example data (mock mode)";

function count(k: number, n: number, evidence_ids: string[] = ["ev_rp_people"]): Count {
  if (n < 10) return { k, n, display: `${k} of ${n} (too few to compare)`, share: null, ci: null, evidence_ids };
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  const r = (x: number) => Math.round(x * 100) / 100;
  return { k, n, display: `at least ${k} of ${n}`, share: Math.round(p * 1000) / 1000, ci: [r(centre - half), r(centre + half)], evidence_ids };
}

const evidence: Evidence[] = [
  {
    id: "ev_rp_people",
    endpoint: "/person/search",
    filters: { current_title: "Data Engineer", current_city: "Berlin", current_country: "Germany" },
    total_count: 268,
    results_used: 200,
    fetched_at: FETCHED,
    source: "mock",
    note: "Example data: the first 200 of 268 matching profiles were read",
  },
];

/* ---- full result: 268 people, Data Engineer in Berlin ---- */

const feeders: [string, number][] = [
  ["Infosys", 23],
  ["TCS", 19],
  ["Accenture", 16],
  ["Zalando", 14],
  ["Delivery Hero", 12],
  ["SAP", 11],
  ["Capgemini", 9],
];
const titles: [string, number][] = [
  ["Software Engineer", 71],
  ["Data Analyst", 48],
  ["Working Student, Data", 39],
  ["Systems Engineer", 27],
  ["Junior Data Engineer", 24],
  ["Backend Engineer", 19],
];

const row = (cells: Record<string, string | number>, extra: Partial<{ you: boolean; rest: boolean; count: Count }> = {}) => ({ cells, ...extra });

const fullResult: ResultEnvelope = {
  tool: "routes_to_position",
  title: "How people became a Data Engineer in Berlin",
  summary:
    "Riya, 268 people we can see are Data Engineers in Berlin today. The widest door is a software or systems engineering job first, and about one in five came from a large IT services firm like the one you work at. Most arrived with 1 to 5 years of experience, so your 2 years sit right in the common range.",
  cohort: {
    definition: "People whose current title is Data Engineer, working in Berlin, Germany, with a visible profile",
    filters: { title: "Data Engineer", city: "Berlin", country: "Germany" },
    n_visible: 268,
    match_level: "field_only",
    widened: false,
    widened_reason: null,
  },
  confidence: "high",
  coverage_note:
    "Based on 268 visible profiles of people now working as Data Engineers in Berlin; people without public profiles are not counted. We read 200 of them in detail.",
  data_date: "2026-11-06",
  sections: [
    {
      id: "graph",
      kind: "routes",
      title: "Where they came from",
      evidence_ids: ["ev_rp_people"],
      data: {
        caption: "Each line is a count of people. Feeder employers on the left, the job title just before on the middle, the position on the right.",
        nodes: [
          { id: "f_infosys", label: "Infosys", kind: "employer" },
          { id: "f_tcs", label: "TCS", kind: "employer" },
          { id: "f_accenture", label: "Accenture", kind: "employer" },
          { id: "f_zalando", label: "Zalando", kind: "employer" },
          { id: "f_dh", label: "Delivery Hero", kind: "employer" },
          { id: "f_other", label: "Other employers", kind: "employer" },
          { id: "t_swe", label: "Software Engineer", kind: "title" },
          { id: "t_da", label: "Data Analyst", kind: "title" },
          { id: "t_ws", label: "Working Student, Data", kind: "title" },
          { id: "t_sys", label: "Systems Engineer", kind: "title" },
          { id: "t_jde", label: "Junior Data Engineer", kind: "title" },
          { id: "t_be", label: "Backend Engineer", kind: "title" },
          { id: "t_other", label: "Other titles", kind: "title" },
          { id: "goal", label: "Data Engineer, Berlin", kind: "goal" },
        ],
        edges: [
          { from: "f_infosys", to: "t_sys", count: 14 },
          { from: "f_infosys", to: "t_swe", count: 6 },
          { from: "f_infosys", to: "t_da", count: 3 },
          { from: "f_tcs", to: "t_sys", count: 9 },
          { from: "f_tcs", to: "t_swe", count: 7 },
          { from: "f_tcs", to: "t_da", count: 3 },
          { from: "f_accenture", to: "t_swe", count: 8 },
          { from: "f_accenture", to: "t_da", count: 5 },
          { from: "f_accenture", to: "t_be", count: 3 },
          { from: "f_zalando", to: "t_ws", count: 7 },
          { from: "f_zalando", to: "t_jde", count: 5 },
          { from: "f_zalando", to: "t_da", count: 2 },
          { from: "f_dh", to: "t_jde", count: 6 },
          { from: "f_dh", to: "t_be", count: 4 },
          { from: "f_dh", to: "t_swe", count: 2 },
          { from: "f_other", to: "t_sys", count: 4 },
          { from: "f_other", to: "t_swe", count: 48 },
          { from: "f_other", to: "t_da", count: 35 },
          { from: "f_other", to: "t_be", count: 12 },
          { from: "f_other", to: "t_ws", count: 32 },
          { from: "f_other", to: "t_jde", count: 13 },
          { from: "f_other", to: "t_other", count: 40 },
          { from: "t_swe", to: "goal", count: 71 },
          { from: "t_da", to: "goal", count: 48 },
          { from: "t_ws", to: "goal", count: 39 },
          { from: "t_sys", to: "goal", count: 27 },
          { from: "t_jde", to: "goal", count: 24 },
          { from: "t_be", to: "goal", count: 19 },
          { from: "t_other", to: "goal", count: 40 },
        ],
      },
    },
    {
      id: "feeders",
      kind: "ranked_table",
      title: "Employers they came from",
      evidence_ids: ["ev_rp_people"],
      data: {
        n: 268,
        caption: "The employer held just before becoming a Data Engineer in Berlin. Rows with fewer than 5 people are folded into Other.",
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [
          row({ employer: "Infosys", people: 23 }, { you: true, count: count(23, 268) }),
          ...feeders.slice(1).map(([employer, people]) => row({ employer, people }, { count: count(people, 268) })),
          row({ employer: "Other employers", people: 164 }, { rest: true }),
        ],
        default_sort: { key: "people", dir: "desc" },
      },
    },
    {
      id: "titles",
      kind: "ranked_table",
      title: "Titles just before",
      evidence_ids: ["ev_rp_people"],
      data: {
        n: 268,
        columns: [
          { key: "title", label: "Previous title", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [
          ...titles.map(([title, people]) => row({ title, people }, { count: count(people, 268) })),
          row({ title: "Other titles", people: 40 }, { rest: true }),
        ],
        default_sort: { key: "people", dir: "desc" },
      },
    },
    {
      id: "schools",
      kind: "ranked_table",
      title: "Schools and degrees",
      evidence_ids: ["ev_rp_people"],
      data: {
        n: 268,
        caption: "Highest degree listed. Many people list more than one school, so we count the one linked to the move.",
        columns: [
          { key: "school", label: "School and degree", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [
          row({ school: "TU Munich, MSc Informatics", people: 24 }),
          row({ school: "TU Berlin, MSc Computer Science", people: 21 }),
          row({ school: "RWTH Aachen, MSc", people: 15 }),
          row({ school: "VIT Vellore, BTech Computer Science", people: 13 }, { you: true }),
          row({ school: "Uni Mannheim, MSc Data Science", people: 11 }),
          row({ school: "Other schools", people: 184 }, { rest: true }),
        ],
        default_sort: { key: "people", dir: "desc" },
      },
    },
    {
      id: "years",
      kind: "distribution",
      title: "Years of experience at entry",
      evidence_ids: ["ev_rp_people"],
      data: {
        n: 268,
        unit: "people",
        caption: "Work experience a person had when they started as a Data Engineer in Berlin.",
        items: [
          { label: "Under 1 year", count: 41, share: 41 / 268 },
          { label: "1 to 2 years", count: 96, share: 96 / 268, target: true },
          { label: "3 to 5 years", count: 88, share: 88 / 268 },
          { label: "6 or more", count: 43, share: 43 / 268 },
        ],
      },
    },
  ],
  next_steps: [
    {
      label: "See what current Data Engineer postings in Berlin ask for",
      tool: "job_postings",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
  ],
  warnings: [EX, "Titles are grouped by meaning, so a few close titles may sit together."],
  evidence,
};

/* ---- thin result: one company, 7 people ---- */

const thinResult: ResultEnvelope = {
  tool: "routes_to_position",
  title: "How people became a Data Engineer at Zalando in Berlin",
  summary:
    "Only 7 people with a visible profile are Data Engineers at Zalando in Berlin, which is too few to say what the usual route is. Try dropping the company to see the wider Berlin picture.",
  cohort: {
    definition: "People whose current title is Data Engineer at Zalando, Berlin, with a visible profile",
    filters: { title: "Data Engineer", company: "Zalando", city: "Berlin" },
    n_visible: 7,
    match_level: "field_only",
    widened: false,
    widened_reason: null,
  },
  confidence: "low",
  coverage_note: "Based on 7 visible profiles; people without public profiles are not counted. Too few to compare.",
  data_date: "2026-11-06",
  sections: [
    {
      id: "graph",
      kind: "routes",
      title: "Where they came from",
      evidence_ids: ["ev_rp_thin"],
      data: {
        nodes: [
          { id: "f_other", label: "Employers with fewer than 5 people", kind: "employer" },
          { id: "t_other", label: "Titles with fewer than 5 people", kind: "title" },
          { id: "goal", label: "Data Engineer, Zalando, Berlin", kind: "goal" },
        ],
        edges: [
          { from: "f_other", to: "t_other", count: 7 },
          { from: "t_other", to: "goal", count: 7 },
        ],
      },
    },
    {
      id: "feeders",
      kind: "ranked_table",
      title: "Employers they came from",
      evidence_ids: ["ev_rp_thin"],
      data: {
        n: 7,
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [row({ employer: "Other employers", people: 7 }, { rest: true, count: count(7, 7, ["ev_rp_thin"]) })],
      },
    },
    {
      id: "titles",
      kind: "ranked_table",
      title: "Titles just before",
      evidence_ids: ["ev_rp_thin"],
      data: {
        n: 7,
        columns: [
          { key: "title", label: "Previous title", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [row({ title: "Other titles", people: 7 }, { rest: true })],
      },
    },
    {
      id: "schools",
      kind: "ranked_table",
      title: "Schools and degrees",
      evidence_ids: ["ev_rp_thin"],
      data: {
        n: 7,
        columns: [
          { key: "school", label: "School and degree", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: [row({ school: "Other schools", people: 7 }, { rest: true })],
      },
    },
    {
      id: "years",
      kind: "distribution",
      title: "Years of experience at entry",
      evidence_ids: ["ev_rp_thin"],
      data: {
        n: 7,
        unit: "people",
        items: [
          { label: "Under 3 years", count: 3 },
          { label: "3 years or more", count: 4 },
        ],
      },
    },
  ],
  next_steps: [
    {
      label: "Drop the company and see all Data Engineers in Berlin",
      tool: "routes_to_position",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
  ],
  warnings: [EX, "Only 7 people match, so no route is shown as typical. A small sample is not a bad sign for the company."],
  evidence: [
    {
      id: "ev_rp_thin",
      endpoint: "/person/search",
      filters: { current_title: "Data Engineer", current_company: "Zalando", current_city: "Berlin" },
      total_count: 7,
      results_used: 7,
      fetched_at: FETCHED,
      source: "mock",
      note: "Example data: all 7 matching profiles were read",
    },
  ],
};

/* ---- drill tokens: every node, row and band opens the people behind it (CONTRACT Appendix C) ---- */

const PARAMS = { role: "Data Engineer", city: "Berlin", country: "Germany" };
const TOOL = "routes_to_position";
const NODE_DRILL: Record<string, [Parameters<typeof mkDrill>[2], string]> = {
  f_infosys: ["company", "Infosys"],
  f_tcs: ["company", "TCS"],
  f_accenture: ["company", "Accenture"],
  f_zalando: ["company", "Zalando"],
  f_dh: ["company", "Delivery Hero"],
  t_swe: ["route_step", "Software Engineer"],
  t_da: ["route_step", "Data Analyst"],
  t_ws: ["route_step", "Working Student, Data"],
  t_sys: ["route_step", "Systems Engineer"],
  t_jde: ["route_step", "Junior Data Engineer"],
  t_be: ["route_step", "Backend Engineer"],
  goal: ["role", "Data Engineer"],
};

const YEARS_BAND: Record<string, string> = {
  "Under 1 year": "0-1",
  "1 to 2 years": "1-2",
  "3 to 5 years": "3-5",
  "6 or more": "6+",
};

function decorate(result: ResultEnvelope): ResultEnvelope {
  const sections = result.sections.map((s): Section => {
    if (s.kind === "routes") {
      const nodes = s.data.nodes.map((n) => {
        const d = NODE_DRILL[n.id];
        return d ? withDrill(n, mkDrill(TOOL, PARAMS, d[0], d[1], n.id === "goal" ? "Data Engineer, Berlin" : d[1])) : n;
      });
      return { ...s, data: { ...s.data, nodes } };
    }
    if (s.kind === "ranked_table") {
      const dim = s.id === "feeders" ? "company" : s.id === "titles" ? "route_step" : s.id === "schools" ? "school" : null;
      const key = s.id === "feeders" ? "employer" : s.id === "titles" ? "title" : "school";
      if (!dim) return s;
      const rows = s.data.rows.map((r) => {
        const v = String(r.cells[key] ?? "");
        return r.rest ? r : withDrill(r, mkDrill(TOOL, PARAMS, dim, dim === "school" ? v.split(",")[0] : v, v));
      });
      return { ...s, data: { ...s.data, rows } };
    }
    if (s.kind === "distribution" && s.id === "years") {
      const items = s.data.items.map((i) => withDrill(i, mkDrill(TOOL, PARAMS, "years_band", YEARS_BAND[i.label] ?? i.label, i.label)));
      return { ...s, data: { ...s.data, items } };
    }
    return s;
  });
  return { ...result, sections };
}

export const mockResult: ResultEnvelope = decorate(fullResult);
export const mockResultThin: ResultEnvelope = thinResult;
