import { makeCount } from "@/lib/count";
import type { Cohort, Evidence, NextStep, RankedRow, ResultEnvelope } from "@/lib/types";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T09:58:00Z";
const EXAMPLE = "Example data (mock mode)";

const MENTIONS = "Mentions visa sponsorship in postings";
const NL_REGISTER = "On NL sponsor register";

const count = makeCount;

interface Seed {
  employer: string;
  hires: number;
  recent: number;
  senior: number;
  tenure: number;
  signals: string[];
  cities: string[];
  roles: string[];
}

function row(s: Seed, evId: string): RankedRow {
  return {
    id: s.employer.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    cells: {
      employer: s.employer,
      hires: s.hires,
      recent: s.recent,
      senior: count(s.senior, s.hires, [evId]),
      tenure: s.tenure,
      signals: s.signals,
      cities: s.cities,
      roles: s.roles,
    },
    badges: s.signals,
  };
}

const COLUMNS = [
  { key: "employer", label: "Employer", type: "text" as const },
  { key: "hires", label: "Indian-educated people seen", type: "int" as const, bar: true },
  { key: "recent", label: "Started in the last 24 months", type: "int" as const },
  { key: "senior", label: "Reached senior or above", type: "count" as const },
  { key: "tenure", label: "Median stay", type: "years" as const },
  { key: "signals", label: "Visa signals", type: "badges" as const },
];

const METHOD_TEXT = [
  "An employer appears here when at least 5 people whose first degree is from an Indian institution show a stint there on their public profile. Smaller employers are folded into \"Other employers\" so no individual can be picked out.",
  "Each square is one of those people. Solid squares started in the last 24 months, hollow squares started earlier. \"Reached senior or above\" counts people whose title level is senior, lead, manager or higher. \"Median stay\" is how long people at that employer stayed in the role we saw.",
  "Visa signals are facts, not promises. \"Mentions visa sponsorship in postings\" means at least one current job posting from that employer says it sponsors or helps with visas. \"On sponsor register\" means the employer is listed on a public sponsor register. We can only check the UK and Netherlands registers today. A missing badge means we saw no signal, not that the employer does not sponsor.",
].join("\n\n");

/* ------------------------------------------------------------------ */
/* Rich result: Germany, Data Engineer                                  */
/* ------------------------------------------------------------------ */

const EV_PEOPLE = "ev_if_people";
const EV_POSTS = "ev_if_postings";

const filters = { education_country: "India", work_country: "Germany", role: "Data Engineer", started_after: "2020-11" };

const evidence: Evidence[] = [
  {
    id: EV_PEOPLE,
    endpoint: "/person/search",
    filters,
    total_count: 2106,
    results_used: 1000,
    fetched_at: FETCHED,
    source: "mock",
    note: "Read the first 1,000 of 2,106 matching profiles (example data)",
  },
  {
    id: EV_POSTS,
    endpoint: "/job/search",
    filters: { country: "Germany", title: "Data Engineer", mentions_visa_sponsorship: true },
    total_count: 1284,
    results_used: 1284,
    fetched_at: FETCHED,
    source: "mock",
    note: "Current postings checked for visa sponsorship wording (example data)",
  },
];

const cohort: Cohort = {
  definition: "People whose first degree is from an Indian institution and who have worked at an employer in Germany",
  filters,
  n_visible: 1000,
  match_level: "field_only",
  widened: false,
  widened_reason: null,
};

const seeds: Seed[] = [
  { employer: "SAP", hires: 164, recent: 41, senior: 52, tenure: 3.8, signals: [MENTIONS], cities: ["Walldorf", "Berlin", "Munich"], roles: ["Software Engineer", "Data Engineer", "Data Scientist"] },
  { employer: "Siemens", hires: 121, recent: 27, senior: 39, tenure: 4.1, signals: [MENTIONS], cities: ["Munich", "Berlin", "Erlangen"], roles: ["Software Engineer", "Data Engineer", "ML Engineer"] },
  { employer: "Zalando", hires: 88, recent: 30, senior: 21, tenure: 2.6, signals: [MENTIONS], cities: ["Berlin"], roles: ["Data Engineer", "Data Scientist", "Software Engineer"] },
  { employer: "Bosch", hires: 79, recent: 14, senior: 24, tenure: 4.4, signals: [], cities: ["Stuttgart", "Renningen"], roles: ["Software Engineer", "ML Engineer"] },
  { employer: "Delivery Hero", hires: 61, recent: 22, senior: 11, tenure: 2.2, signals: [MENTIONS], cities: ["Berlin"], roles: ["Data Engineer", "Software Engineer"] },
  { employer: "Deutsche Bank", hires: 52, recent: 12, senior: 14, tenure: 3.3, signals: [], cities: ["Frankfurt", "Berlin"], roles: ["Software Engineer", "Data Engineer"] },
  { employer: "Celonis", hires: 44, recent: 19, senior: 8, tenure: 2.1, signals: [MENTIONS], cities: ["Munich"], roles: ["Software Engineer", "Data Engineer"] },
  { employer: "N26", hires: 38, recent: 17, senior: 6, tenure: 1.9, signals: [MENTIONS], cities: ["Berlin"], roles: ["Data Engineer", "Data Scientist"] },
  { employer: "Allianz", hires: 33, recent: 8, senior: 9, tenure: 3.9, signals: [], cities: ["Munich"], roles: ["Data Scientist", "Data Engineer"] },
  { employer: "HelloFresh", hires: 27, recent: 11, senior: 5, tenure: 2.0, signals: [MENTIONS], cities: ["Berlin"], roles: ["Data Engineer", "Data Scientist"] },
  { employer: "Infineon", hires: 21, recent: 6, senior: 6, tenure: 3.5, signals: [], cities: ["Munich"], roles: ["Software Engineer", "ML Engineer"] },
  { employer: "Trade Republic", hires: 17, recent: 9, senior: 2, tenure: 1.6, signals: [MENTIONS], cities: ["Berlin"], roles: ["Data Engineer", "Software Engineer"] },
];

const otherRow: RankedRow = {
  id: "other",
  cells: {
    employer: "Other employers",
    hires: 255,
    recent: 68,
    senior: count(55, 255, [EV_PEOPLE]),
    tenure: null,
    signals: [],
    cities: [],
    roles: [],
  },
  rest: true,
};

export const mockResult: ResultEnvelope = {
  tool: "indian_friendly",
  title: "Employers in Germany that hire Indian-educated people",
  summary:
    "Plenty of people who studied in India have built careers in Germany, and the long-running names (SAP, Siemens, Bosch) show people staying 4 years or more and reaching senior roles. Berlin's newer companies hired the most people recently, with a median stay near 2 years. Eight of the top twelve mention visa sponsorship in their postings; treat that as a good sign to ask about, not a promise.",
  cohort,
  confidence: "high",
  coverage_note:
    "Based on 1,000 of 2,106 visible profiles of Indian-educated people with a stint at an employer in Germany. People without public profiles are not counted, so every figure is a lower bound.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "employers",
      kind: "ranked_table",
      title: "Employers with Indian-educated hires",
      evidence_ids: [EV_PEOPLE, EV_POSTS],
      data: {
        n: 1000,
        columns: COLUMNS,
        rows: [...seeds.map((s) => row(s, EV_PEOPLE)), otherRow],
        default_sort: { key: "hires", dir: "desc" },
        caption: "One square is one person. Solid squares started in the last 24 months.",
      },
    },
    {
      id: "method",
      kind: "text",
      title: "How we decide what counts as Indian-friendly",
      data: { text: METHOD_TEXT },
    },
  ],
  next_steps: [
    {
      label: "See your internship-to-job chances at these employers",
      tool: "internship_chances",
      params: { country: "Germany", role: "Data Engineer" },
    },
    {
      label: "See how crowded Data Engineer is in Germany",
      tool: "market_saturation",
      params: { role: "Data Engineer", country: "Germany", city: "Berlin" },
    },
  ] satisfies NextStep[],
  warnings: [
    EXAMPLE,
    "Germany has no public sponsor register we can check, so no register badge appears. That does not mean employers there do not sponsor.",
    "An employer on this list has hired Indian-educated people. It is not a promise that it will hire or sponsor you.",
  ],
  evidence,
};

/* ------------------------------------------------------------------ */
/* Thin result: Netherlands, Eindhoven                                  */
/* ------------------------------------------------------------------ */

const T_PEOPLE = "ev_if_nl_people";
const T_REG = "ev_if_nl_register";

const thinFilters = { education_country: "India", work_country: "Netherlands", city: "Eindhoven", started_after: "2020-11" };

const thinSeeds: Seed[] = [
  { employer: "Philips", hires: 13, recent: 5, senior: 4, tenure: 3.1, signals: [NL_REGISTER], cities: ["Eindhoven", "Amsterdam"], roles: ["Software Engineer", "Data Engineer"] },
  { employer: "ASML", hires: 11, recent: 6, senior: 2, tenure: 2.4, signals: [NL_REGISTER, MENTIONS], cities: ["Eindhoven"], roles: ["Software Engineer"] },
  { employer: "NXP Semiconductors", hires: 8, recent: 3, senior: 1, tenure: 2.8, signals: [NL_REGISTER], cities: ["Eindhoven"], roles: ["Software Engineer"] },
];

export const mockResultThin: ResultEnvelope = {
  tool: "indian_friendly",
  title: "Employers in the Netherlands that hire Indian-educated people",
  summary:
    "We found only a few Indian-educated people in Eindhoven, so this is an early picture rather than a ranking. The three employers below are on the Dutch sponsor register; it is worth asking each one how they support new hires.",
  cohort: {
    definition: "People whose first degree is from an Indian institution and who have worked at an employer in Eindhoven, Netherlands",
    filters: thinFilters,
    n_visible: 61,
    match_level: "field_only",
    widened: false,
    widened_reason: null,
  },
  confidence: "low",
  coverage_note:
    "Based on 61 visible profiles, which is small. People without public profiles are not counted, so every figure is a lower bound.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "employers",
      kind: "ranked_table",
      title: "Employers with Indian-educated hires",
      evidence_ids: [T_PEOPLE, T_REG],
      data: {
        n: 61,
        columns: COLUMNS,
        rows: [
          ...thinSeeds.map((s) => row(s, T_PEOPLE)),
          {
            id: "other",
            cells: {
              employer: "Other employers",
              hires: 29,
              recent: 11,
              senior: count(6, 29, [T_PEOPLE]),
              tenure: null,
              signals: [],
              cities: [],
              roles: [],
            },
            rest: true,
          },
        ],
        default_sort: { key: "hires", dir: "desc" },
        caption: "One square is one person. Solid squares started in the last 24 months.",
      },
    },
    {
      id: "method",
      kind: "text",
      title: "How we decide what counts as Indian-friendly",
      data: { text: METHOD_TEXT },
    },
  ],
  next_steps: [
    {
      label: "Widen to the whole Netherlands",
      tool: "indian_friendly",
      params: { country: "Netherlands" },
    },
  ],
  warnings: [
    EXAMPLE,
    "Only 61 profiles match, so shares under 10 people are not shown as percentages and the ranking can change with a few more profiles.",
    "A register badge means the employer is listed as a recognised sponsor. It is not a promise that it will hire or sponsor you.",
  ],
  evidence: [
    {
      id: T_PEOPLE,
      endpoint: "/person/search",
      filters: thinFilters,
      total_count: 61,
      results_used: 61,
      fetched_at: FETCHED,
      source: "mock",
      note: "Read all 61 matching profiles (example data)",
    },
    {
      id: T_REG,
      endpoint: "web/fetch",
      filters: { register: "IND recognised sponsors (NL)" },
      total_count: 3,
      results_used: 3,
      fetched_at: FETCHED,
      source: "mock",
      note: "Matched employer names against the public Dutch sponsor register (example data)",
    },
  ],
};
