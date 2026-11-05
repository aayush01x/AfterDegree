import { makeCount as count } from "@/lib/count";
import type { DrillToken } from "@/lib/drill-types";
import type { Cohort, Evidence, RankedRow, ResultEnvelope } from "@/lib/types";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T09:52:00Z";
const EXAMPLE = "Example data (mock mode)";

const filters = {
  country: "Germany",
  role: "Data Engineer",
  title_contains: ["intern", "working student"],
  cohort: "BTech CSE, private tier-1 colleges, 2020-2024",
};

/** Drill token the engine attaches to a company row: this run's params plus the company step. */
const companyDrill = (company: string, params: Record<string, unknown>): DrillToken => ({
  tool: "internship_chances",
  params,
  path: [{ dimension: "company", value: company, label: company }],
});
const withDrill = <T extends object>(row: T, drill: DrillToken): T => ({ ...row, drill });
const runParams = { country: "Germany", role: "Data Engineer" };
const drillRow = (row: RankedRow, params: Record<string, unknown>): RankedRow =>
  row.rest ? row : withDrill(row, companyDrill(String(row.cells.company), params));

const evidence: Evidence[] = [
  {
    id: "ev_ic_interns",
    endpoint: "/person/search",
    filters,
    total_count: 37,
    results_used: 37,
    fetched_at: FETCHED,
    source: "mock",
    note: "Every matching internship or working-student role was read (example data)",
  },
];

const cohort: Cohort = {
  definition: "BTech CSE graduates of private tier-1 colleges (2020–2024) who interned or were working students in Germany",
  filters,
  n_visible: 37,
  match_level: "school_tier",
  widened: false,
  widened_reason: null,
};

const METHOD =
  "We looked at people with your background (BTech in computer science from a private tier-1 college, graduated 2020 to 2024) who held an internship or working-student role in Germany. " +
  "For each one, we checked whether the same company shows up later on their profile as a full-time job. If it does, we count them as converted. " +
  "We can only count people whose profiles are public, and a company that renamed itself or a job not listed on a profile will be missed, so the number is “at least”. " +
  "Companies with fewer than 5 interns are grouped as “Other companies”, and no individual is ever shown.";

/** Riya Menon: Germany, data roles. 24 of 37 converted. */
export const mockResult: ResultEnvelope = {
  tool: "internship_chances",
  title: "Internship-to-job chances in Germany",
  summary:
    "Among people like you who interned or worked as students in Germany, at least 24 of 37 later went full-time at the same company. That is a good sign, but the range is wide, so treat it as “more often than not”, not a promise. SAP is on your list and has converted 8 of 11.",
  cohort,
  confidence: "medium",
  coverage_note:
    "Based on 37 visible internships; a conversion counts only when the same company appears as a full-time role afterwards. People without public profiles are not counted.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "chance",
      kind: "stat",
      title: "Your chance",
      data: {
        label: "interns and working students later went full-time at the same company",
        count: count(24, 37, ["ev_ic_interns"]),
      },
      evidence_ids: ["ev_ic_interns"],
    },
    {
      id: "companies",
      kind: "ranked_table",
      title: "Companies by conversion",
      data: {
        n: 37,
        caption: "for people like you",
        columns: [
          { key: "company", label: "Company", type: "text" },
          { key: "interns", label: "Interns seen", type: "int" },
          { key: "converted", label: "Went full-time", type: "int" },
          { key: "chance", label: "Chance", type: "count", bar: true },
        ],
        rows: [
          { cells: { company: "SAP", interns: 11, converted: 8, chance: count(8, 11, ["ev_ic_interns"]) }, count: count(8, 11, ["ev_ic_interns"]), you: true },
          { cells: { company: "Bosch", interns: 14, converted: 9, chance: count(9, 14, ["ev_ic_interns"]) }, count: count(9, 14, ["ev_ic_interns"]) },
          { cells: { company: "Siemens", interns: 6, converted: 4, chance: count(4, 6, ["ev_ic_interns"]) }, count: count(4, 6, ["ev_ic_interns"]) },
          { cells: { company: "Other companies", interns: 6, converted: 3, chance: count(3, 6, ["ev_ic_interns"]) }, count: count(3, 6, ["ev_ic_interns"]), rest: true },
        ].map((r) => drillRow(r, runParams)),
        default_sort: { key: "chance", dir: "desc" },
      },
      evidence_ids: ["ev_ic_interns"],
    },
    {
      id: "method",
      kind: "text",
      title: "How we worked this out",
      data: { text: METHOD },
    },
  ],
  next_steps: [
    {
      label: "See which employers in Germany hire Indian-educated people",
      tool: "indian_friendly",
      params: { country: "Germany", role: "Data Engineer" },
    },
  ],
  warnings: [EXAMPLE],
  evidence,
};

/** A narrow ask (one small company in a small market): few interns, widened, low confidence. */
const thinFilters = { ...filters, country: "Austria", cohort: "BTech CSE, any college, 2018-2024 (widened)" };

export const mockResultThin: ResultEnvelope = {
  tool: "internship_chances",
  title: "Internship-to-job chances in Austria",
  summary:
    "We found only 7 people like you with an internship or working-student role in Austria, even after widening to all colleges, and 4 of them went full-time at the same company. That is too few to call a chance. It is a hint, not an answer. Try Germany or a wider role to see a fairer picture.",
  cohort: {
    definition: "BTech CSE graduates of any Indian college (2018–2024) who interned or were working students in Austria",
    filters: thinFilters,
    n_visible: 7,
    match_level: "field_only",
    widened: true,
    widened_reason:
      "Only 2 people from private tier-1 colleges interned in Austria, so we included every Indian college with the same field. It is still a small group.",
  },
  confidence: "low",
  coverage_note:
    "Based on 7 visible internships; people without public profiles are not counted. Companies with fewer than 5 interns are not broken out.",
  data_date: DATA_DATE,
  sections: [
    {
      id: "chance",
      kind: "stat",
      title: "Your chance",
      data: {
        label: "interns and working students later went full-time at the same company",
        count: count(4, 7, ["ev_ic_interns_thin"]),
      },
      evidence_ids: ["ev_ic_interns_thin"],
    },
    {
      id: "companies",
      kind: "ranked_table",
      title: "Companies by conversion",
      data: {
        n: 7,
        caption: "for people like you",
        columns: [
          { key: "company", label: "Company", type: "text" },
          { key: "interns", label: "Interns seen", type: "int" },
          { key: "converted", label: "Went full-time", type: "int" },
          { key: "chance", label: "Chance", type: "count" },
        ],
        rows: [
          {
            cells: { company: "Companies with fewer than 5 interns each", interns: 7, converted: 4, chance: count(4, 7, ["ev_ic_interns_thin"]) },
            count: count(4, 7, ["ev_ic_interns_thin"]),
            rest: true,
          },
        ],
      },
      evidence_ids: ["ev_ic_interns_thin"],
    },
    {
      id: "method",
      kind: "text",
      title: "How we worked this out",
      data: { text: METHOD.replace("in Germany", "in Austria") },
    },
  ],
  next_steps: [
    {
      label: "Check Germany, where there is more data",
      tool: "internship_chances",
      params: { country: "Germany", role: "Data Engineer" },
    },
  ],
  warnings: [
    EXAMPLE,
    "Fewer than 10 people match. We show the counts as they are and no percentage, because one person more or less would change it a lot.",
  ],
  evidence: [
    {
      id: "ev_ic_interns_thin",
      endpoint: "/person/search",
      filters: thinFilters,
      total_count: 7,
      results_used: 7,
      fetched_at: FETCHED,
      source: "mock",
      note: "All 7 matching internships were read (example data)",
    },
  ],
};
