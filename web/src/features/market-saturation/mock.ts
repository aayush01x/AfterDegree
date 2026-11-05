import { makeCount } from "@/lib/count";
import type { Cohort, Evidence, NextStep, RankedRow, ResultEnvelope, Section } from "@/lib/types";
import { levelFor } from "./config";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T10:04:00Z";
const EXAMPLE = "Example data (mock mode)";

const QUARTERS = ["2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ratioText = (r: number) => (Math.round(r * 10) / 10).toFixed(1);

/** Entrants over the last four quarters; openings = latest quarter (about 90 days) times four. */
function totals(entrantsQ: number[], openingsQ: number[]) {
  const entrants = sum(entrantsQ.slice(-4));
  const lastQuarter = openingsQ[openingsQ.length - 1];
  const openings = lastQuarter * 4;
  return { entrants, openings, lastQuarter, ratio: entrants / openings };
}

function cityRow(city: string, entrants: number, openings: number, you = false): RankedRow {
  const ratio = entrants / openings;
  return {
    id: city.toLowerCase(),
    cells: { city, ratio: ratioText(ratio), level: entrants >= 10 ? levelFor(ratio) : null, entrants, openings },
    you: you || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Rich result: Data Engineer, Berlin                                   */
/* ------------------------------------------------------------------ */

const ENTRANTS_Q = [22, 25, 27, 30, 31, 36, 41, 44];
const OPENINGS_Q = [52, 50, 48, 46, 44, 40, 36, 31];
const T = totals(ENTRANTS_Q, OPENINGS_Q); // 152 entrants, 124 openings, ratio 1.23

const filters = {
  degree: "BTech",
  field: "Computer Science",
  school_country: "India",
  role: "Data Engineer",
  city: "Berlin",
  country: "Germany",
};

const evidence: Evidence[] = [
  {
    id: "ev_ms_entrants",
    endpoint: "/person/search",
    filters: { ...filters, started_role_after: "2025-11" },
    total_count: 152,
    results_used: 152,
    fetched_at: FETCHED,
    source: "mock",
    note: "People like you who started as a Data Engineer in Berlin in the last 12 months (example data)",
  },
  {
    id: "ev_ms_openings",
    endpoint: "/job/search",
    filters: { title: "Data Engineer", city: "Berlin", country: "Germany", posted_within_days: 90 },
    total_count: 31,
    results_used: 31,
    fetched_at: FETCHED,
    source: "mock",
    note: "Postings found in the last 90 days, multiplied by four for a yearly figure (example data)",
  },
];

const cohort: Cohort = {
  definition: "BTech CSE graduates of Indian colleges, 0–4 years of work, starting as a Data Engineer in Berlin",
  filters,
  n_visible: 152,
  match_level: "field_only",
  widened: true,
  widened_reason: "Too few people from VIT Vellore alone, so we counted similar Indian colleges in the same field.",
};

const sections: Section[] = [
  {
    id: "ratio",
    kind: "stat",
    title: "Entrants per opening",
    evidence_ids: ["ev_ms_entrants", "ev_ms_openings"],
    data: {
      label: "new entrants like you per open posting",
      value: Math.round(T.ratio * 10) / 10,
      display: ratioText(T.ratio),
      level: levelFor(T.ratio),
      note: "152 newcomers over the last 12 months, against 124 openings a year",
    },
  },
  {
    id: "entrants",
    kind: "stat",
    title: "New entrants like you",
    evidence_ids: ["ev_ms_entrants"],
    data: { label: "people like you who started as a Data Engineer in Berlin, last 12 months", value: T.entrants, unit: "people" },
  },
  {
    id: "openings",
    kind: "stat",
    title: "Open postings",
    evidence_ids: ["ev_ms_openings"],
    data: {
      label: "Data Engineer postings in Berlin, last 90 days, annualised",
      value: T.openings,
      unit: "postings a year",
      note: `${T.lastQuarter} postings in 90 days, times four`,
    },
  },
  {
    id: "trend",
    kind: "timeseries",
    title: "Entrants and openings by quarter",
    evidence_ids: ["ev_ms_entrants", "ev_ms_openings"],
    data: {
      unit: "per quarter",
      caption: "Newcomers like you are rising while postings are easing, so the gap has been closing for a year.",
      series: [
        { key: "entrants", label: "Entrants like you", points: QUARTERS.map((period, i) => ({ period, value: ENTRANTS_Q[i] })) },
        { key: "openings", label: "Openings", points: QUARTERS.map((period, i) => ({ period, value: OPENINGS_Q[i] })) },
      ],
    },
  },
  {
    id: "read",
    kind: "text",
    title: "What this means for you",
    data: {
      text:
        "About 1.2 new people with your background arrive for every opening in Berlin. That is a balanced market: neither easy nor shut. A year ago there were twice as many openings as newcomers, so it has tightened, and the next few quarters are worth watching.\n\nWhen the market is balanced, a clear story helps your application stand out: one or two data-engineering projects, and the tools Berlin postings ask for most. The job-postings tool shows which ones.",
    },
  },
  {
    id: "cities",
    kind: "ranked_table",
    title: "Comparable cities",
    evidence_ids: ["ev_ms_entrants", "ev_ms_openings"],
    data: {
      n: 152,
      columns: [
        { key: "city", label: "City", type: "text" },
        { key: "ratio", label: "Entrants per opening", type: "text" },
        { key: "entrants", label: "Entrants, 12 months", type: "int", bar: true },
        { key: "openings", label: "Openings, annualised", type: "int", bar: true },
      ],
      rows: [
        cityRow("Berlin", T.entrants, T.openings, true),
        cityRow("Munich", 96, 148),
        cityRow("Hamburg", 60, 72),
        cityRow("Frankfurt", 64, 60),
        cityRow("Stuttgart", 34, 52),
        cityRow("Amsterdam", 118, 84),
      ],
      default_sort: { key: "ratio", dir: "asc" },
      caption: "Lower means fewer newcomers for each opening. Your target city is highlighted.",
    },
  },
];

export const mockResult: ResultEnvelope = {
  tool: "market_saturation",
  title: "How crowded Data Engineer is in Berlin",
  summary:
    "Berlin is a balanced market for a Data Engineer with your background: about 1.2 newcomers for every opening. It has been tightening for a year, and Munich and Stuttgart currently have more room.",
  cohort,
  confidence: "medium",
  coverage_note:
    "Based on 152 visible profiles that started the role in the last 12 months and 31 postings from the last 90 days. People without public profiles and postings not listed online are not counted.",
  data_date: DATA_DATE,
  sections,
  next_steps: [
    {
      label: "See what Berlin Data Engineer postings ask for",
      tool: "job_postings",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
    {
      label: "See the routes into Data Engineer roles in Berlin",
      tool: "reverse_gps",
      params: { goal_text: "Data Engineer in Berlin" },
    },
  ] satisfies NextStep[],
  warnings: [
    EXAMPLE,
    "Newcomers are counted over 12 months and openings over the last 90 days, annualised, so a seasonal dip in postings can make the market look busier than it is.",
    "This compares people who got in with openings that exist today. It does not say how many applied.",
  ],
  evidence,
};

/* ------------------------------------------------------------------ */
/* Thin result: Data Engineer, Leipzig                                  */
/* ------------------------------------------------------------------ */

const THIN_ENTRANTS_Q = [1, 1, 1, 2, 2, 1, 2, 2];
const THIN_OPENINGS_Q = [4, 3, 4, 3, 3, 3, 3, 3];
const TT = totals(THIN_ENTRANTS_Q, THIN_OPENINGS_Q); // 7 entrants, 12 openings

const thinFilters = { ...filters, city: "Leipzig" };

export const mockResultThin: ResultEnvelope = {
  tool: "market_saturation",
  title: "How crowded Data Engineer is in Leipzig",
  summary:
    "Leipzig is a small market, so we found only a handful of people and postings. That is too little to call it crowded or open. Berlin and Dresden give a steadier picture while you wait for more data.",
  cohort: {
    definition: "BTech CSE graduates of Indian colleges, 0–4 years of work, starting as a Data Engineer in Leipzig",
    filters: thinFilters,
    n_visible: 7,
    match_level: "field_only",
    widened: true,
    widened_reason: "Too few people from VIT Vellore alone, so we counted similar Indian colleges in the same field.",
  },
  confidence: "low",
  coverage_note: "Based on 7 visible profiles and 3 postings, which is very small. Treat every figure as a rough lower bound.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "ratio",
      kind: "stat",
      title: "Entrants per opening",
      evidence_ids: ["ev_ms_t_entrants", "ev_ms_t_openings"],
      data: {
        label: "new entrants like you per open posting",
        value: Math.round(TT.ratio * 10) / 10,
        display: ratioText(TT.ratio),
        level: null,
        note: "Too few people and postings to call this low, medium or high",
      },
    },
    {
      id: "entrants",
      kind: "stat",
      title: "New entrants like you",
      evidence_ids: ["ev_ms_t_entrants"],
      data: {
        label: "people like you who started as a Data Engineer in Leipzig, last 12 months",
        value: TT.entrants,
        count: makeCount(TT.entrants, TT.entrants, ["ev_ms_t_entrants"]),
        unit: "people",
      },
    },
    {
      id: "openings",
      kind: "stat",
      title: "Open postings",
      evidence_ids: ["ev_ms_t_openings"],
      data: {
        label: "Data Engineer postings in Leipzig, last 90 days, annualised",
        value: TT.openings,
        unit: "postings a year",
        note: `${TT.lastQuarter} postings in 90 days, times four`,
      },
    },
    {
      id: "trend",
      kind: "timeseries",
      title: "Entrants and openings by quarter",
      evidence_ids: ["ev_ms_t_entrants", "ev_ms_t_openings"],
      data: {
        unit: "per quarter",
        series: [
          { key: "entrants", label: "Entrants like you", points: QUARTERS.map((period, i) => ({ period, value: THIN_ENTRANTS_Q[i] })) },
          { key: "openings", label: "Openings", points: QUARTERS.map((period, i) => ({ period, value: THIN_OPENINGS_Q[i] })) },
        ],
      },
    },
    {
      id: "read",
      kind: "text",
      title: "What this means for you",
      data: {
        text:
          "With only a few people and postings a quarter, one hire or one posting moves the picture a lot. Unknown is not bad: it means Leipzig is small, not that it is closed to you.\n\nIf you are open to a bigger city, the comparison below shows where there is more to learn from.",
      },
    },
    {
      id: "cities",
      kind: "ranked_table",
      title: "Comparable cities",
      evidence_ids: ["ev_ms_t_entrants", "ev_ms_t_openings"],
      data: {
        n: 7,
        columns: [
          { key: "city", label: "City", type: "text" },
          { key: "ratio", label: "Entrants per opening", type: "text" },
          { key: "entrants", label: "Entrants, 12 months", type: "int", bar: true },
          { key: "openings", label: "Openings, annualised", type: "int", bar: true },
        ],
        rows: [
          cityRow("Leipzig", TT.entrants, TT.openings, true),
          cityRow("Dresden", 6, 20),
          cityRow("Berlin", 152, 124),
        ],
        default_sort: { key: "ratio", dir: "asc" },
        caption: "Lower means fewer newcomers for each opening. Your target city is highlighted.",
      },
    },
  ],
  next_steps: [
    {
      label: "Check Berlin instead",
      tool: "market_saturation",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
  ],
  warnings: [
    EXAMPLE,
    "Only 7 people and 3 postings were found, so there is no low, medium or high label. A few more profiles could change the picture.",
  ],
  evidence: [
    {
      id: "ev_ms_t_entrants",
      endpoint: "/person/search",
      filters: { ...thinFilters, started_role_after: "2025-11" },
      total_count: 7,
      results_used: 7,
      fetched_at: FETCHED,
      source: "mock",
      note: "Read all 7 matching profiles (example data)",
    },
    {
      id: "ev_ms_t_openings",
      endpoint: "/job/search",
      filters: { title: "Data Engineer", city: "Leipzig", country: "Germany", posted_within_days: 90 },
      total_count: 3,
      results_used: 3,
      fetched_at: FETCHED,
      source: "mock",
      note: "Postings found in the last 90 days, multiplied by four (example data)",
    },
  ],
};
