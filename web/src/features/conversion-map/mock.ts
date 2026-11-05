import { makeCount } from "@/lib/count";
import type {
  DistributionItem,
  Evidence,
  RankedRow,
  ResultEnvelope,
} from "@/lib/types";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T09:52:00Z";

const count = makeCount;

const evidence = (id: string, endpoint: string, total: number, used: number, filters: Record<string, unknown>): Evidence => ({
  id,
  endpoint,
  filters,
  total_count: total,
  results_used: used,
  fetched_at: FETCHED,
  source: "mock",
  note: `Example data: sampled ${used} of ${total} matching profiles`,
});

type Seed = { company: string; country: string; seen: number; converted: number };

function row(s: Seed, evId: string): RankedRow {
  return {
    id: s.company.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    cells: { company: s.company, country: s.country, seen: s.seen, converted: s.converted },
    count: count(s.converted, s.seen, [evId]),
  };
}

function restRow(seen: number, converted: number, evId: string): RankedRow {
  return {
    id: "other",
    cells: { company: "Other companies (fewer than 5 people each)", country: "Various", seen, converted },
    count: count(converted, seen, [evId]),
    rest: true,
  };
}

const COLUMNS = [
  { key: "company", label: "Company", type: "text" as const },
  { key: "country", label: "Country", type: "text" as const },
  { key: "seen", label: "Interns seen", type: "int" as const },
  { key: "converted", label: "Went full-time", type: "int" as const },
  { key: "chance", label: "Chance", type: "count" as const },
];

function byCountry(seeds: Seed[], rest: { seen: number; converted: number }, evId: string): DistributionItem[] {
  const map = new Map<string, { seen: number; converted: number }>();
  for (const s of seeds) {
    const c = map.get(s.country) ?? { seen: 0, converted: 0 };
    c.seen += s.seen;
    c.converted += s.converted;
    map.set(s.country, c);
  }
  const items: DistributionItem[] = [...map.entries()]
    .sort((a, b) => b[1].converted / b[1].seen - a[1].converted / a[1].seen)
    .map(([label, v]) => ({
      label,
      count: v.converted,
      share: Math.round((v.converted / v.seen) * 1000) / 1000,
      target: label === "Germany",
    }));
  items.push({
    label: "Other countries",
    count: rest.converted,
    share: Math.round((rest.converted / rest.seen) * 1000) / 1000,
    target: false,
    remainder: true,
  });
  void evId;
  return items;
}

/* ------------------------------------------------------------------ */
/* Rich result: Riya Menon, scope = Computer Science, any country      */
/* ------------------------------------------------------------------ */

const SEEDS: Seed[] = [
  { company: "SAP", country: "Germany", seen: 36, converted: 24 },
  { company: "Siemens", country: "Germany", seen: 29, converted: 16 },
  { company: "Zalando", country: "Germany", seen: 22, converted: 14 },
  { company: "Bosch", country: "Germany", seen: 25, converted: 11 },
  { company: "Delivery Hero", country: "Germany", seen: 14, converted: 9 },
  { company: "Google", country: "United States", seen: 33, converted: 19 },
  { company: "Microsoft", country: "United States", seen: 28, converted: 17 },
  { company: "Amazon", country: "United States", seen: 40, converted: 18 },
  { company: "Adobe", country: "United States", seen: 12, converted: 8 },
  { company: "Booking.com", country: "Netherlands", seen: 18, converted: 11 },
  { company: "ASML", country: "Netherlands", seen: 9, converted: 5 },
  { company: "Shopify", country: "Canada", seen: 11, converted: 8 },
  { company: "RBC", country: "Canada", seen: 15, converted: 7 },
  { company: "Arm", country: "United Kingdom", seen: 10, converted: 6 },
  { company: "Barclays", country: "United Kingdom", seen: 13, converted: 5 },
  { company: "Flipkart", country: "India", seen: 21, converted: 13 },
  { company: "Zoho", country: "India", seen: 17, converted: 12 },
];
const REST = { seen: 31, converted: 9 };
const TOTAL_SEEN = SEEDS.reduce((a, s) => a + s.seen, 0) + REST.seen;
const TOTAL_CONV = SEEDS.reduce((a, s) => a + s.converted, 0) + REST.converted;

export const mockResult: ResultEnvelope = {
  tool: "conversion_map",
  title: "Which companies turn interns into employees",
  summary:
    "More than half of the interns and working students we can see went full-time at the same company. In Germany, SAP leads at about two in three, with Zalando and Delivery Hero close behind. Treat every row as a lower bound: people without public profiles are not counted.",
  cohort: {
    definition:
      "Interns and working students in Computer Science from private tier-1 Indian colleges (2019–2023 graduates), at companies in Germany, the US, the Netherlands, Canada, the UK and India",
    filters: { field: "Computer Science", school_tier: "private_tier_1", grad_years: [2019, 2023], min_row_size: 5 },
    n_visible: TOTAL_SEEN,
    match_level: "school_tier",
    widened: false,
    widened_reason: null,
  },
  confidence: "medium",
  coverage_note: `Based on ${TOTAL_SEEN} visible interns and working students; people without public profiles are not counted, so every figure is "at least". Companies with fewer than 5 people are folded into "Other".`,
  data_date: DATA_DATE,
  sections: [
    {
      id: "overall",
      kind: "stat",
      title: "The overall chance",
      data: {
        label: "interns and working students went full-time at the same company",
        count: count(TOTAL_CONV, TOTAL_SEEN, ["ev_cm_1"]),
        note: "Same company, within 12 months of the internship ending.",
      },
      evidence_ids: ["ev_cm_1"],
    },
    {
      id: "companies",
      kind: "ranked_table",
      title: "Companies, ranked by chance",
      data: {
        n: TOTAL_SEEN,
        columns: COLUMNS,
        rows: [...SEEDS.map((s) => row(s, "ev_cm_2")), restRow(REST.seen, REST.converted, "ev_cm_2")],
        default_sort: { key: "chance", dir: "desc" },
        caption: "One square is one intern or working student. Filled means they went full-time at that company.",
      },
      evidence_ids: ["ev_cm_2"],
    },
    {
      id: "by_country",
      kind: "distribution",
      title: "Conversion by country",
      data: {
        n: TOTAL_SEEN,
        unit: "people who went full-time",
        items: byCountry(SEEDS, REST, "ev_cm_2"),
        caption: "People who went full-time, by the country of the company.",
      },
      evidence_ids: ["ev_cm_2"],
    },
    {
      id: "method",
      kind: "text",
      title: "How we counted",
      data: {
        text: "We follow each intern or working student forward. If the same person holds a regular role at the same company within 12 months of the internship ending, we count them as converted. Companies with fewer than 5 people are grouped so nobody can be picked out.",
      },
    },
  ],
  next_steps: [
    {
      label: "See your Internship-to-Job chances at SAP in Germany",
      tool: "internship_chances",
      params: { company: "SAP", country: "Germany" },
    },
    {
      label: "Trace the routes to a Data Engineer role in Berlin",
      tool: "reverse_gps",
      params: { goal_text: "Data Engineer in Berlin" },
    },
  ],
  warnings: ["Example data (mock mode)"],
  evidence: [
    evidence("ev_cm_1", "/person/search", 1840, 200, { field: "Computer Science", role_type: ["intern", "working student"] }),
    evidence("ev_cm_2", "/person/search", 1840, 200, { group_by: "company", min_row_size: 5 }),
  ],
};

/* ------------------------------------------------------------------ */
/* Thin result: narrowed to VIT Vellore in the Netherlands, widened    */
/* ------------------------------------------------------------------ */

const THIN: Seed[] = [
  { company: "Booking.com", country: "Netherlands", seen: 7, converted: 4 },
  { company: "ASML", country: "Netherlands", seen: 6, converted: 3 },
  { company: "Philips", country: "Netherlands", seen: 5, converted: 2 },
];
const THIN_REST = { seen: 4, converted: 1 };
const THIN_SEEN = THIN.reduce((a, s) => a + s.seen, 0) + THIN_REST.seen;
const THIN_CONV = THIN.reduce((a, s) => a + s.converted, 0) + THIN_REST.converted;

export const mockResultThin: ResultEnvelope = {
  tool: "conversion_map",
  title: "Which companies turn interns into employees",
  summary:
    "We found only a handful of VIT Vellore interns in the Netherlands, so we looked at similar colleges too. Even so, the numbers are small. Read the squares as a first glimpse, not a verdict.",
  cohort: {
    definition: "Interns and working students in Computer Science from VIT Vellore and similar private colleges, at companies in the Netherlands",
    filters: { school: "VIT Vellore", field: "Computer Science", country: "Netherlands", min_row_size: 5 },
    n_visible: THIN_SEEN,
    match_level: "school_tier",
    widened: true,
    widened_reason: "Only 9 VIT Vellore interns were visible in the Netherlands, so we included similar private colleges.",
  },
  confidence: "low",
  coverage_note: `Based on ${THIN_SEEN} visible interns and working students; very few, so treat every figure as a rough lower bound.`,
  data_date: DATA_DATE,
  sections: [
    {
      id: "overall",
      kind: "stat",
      title: "The overall chance",
      data: {
        label: "interns and working students went full-time at the same company",
        count: count(THIN_CONV, THIN_SEEN, ["ev_cmt_1"]),
        note: "Too few people to compare companies with confidence.",
      },
      evidence_ids: ["ev_cmt_1"],
    },
    {
      id: "companies",
      kind: "ranked_table",
      title: "Companies, ranked by chance",
      data: {
        n: THIN_SEEN,
        columns: COLUMNS,
        rows: [...THIN.map((s) => row(s, "ev_cmt_2")), restRow(THIN_REST.seen, THIN_REST.converted, "ev_cmt_2")],
        default_sort: { key: "chance", dir: "desc" },
        caption: "One square is one intern or working student. Filled means they went full-time at that company.",
      },
      evidence_ids: ["ev_cmt_2"],
    },
    {
      id: "by_country",
      kind: "distribution",
      title: "Conversion by country",
      data: {
        n: THIN_SEEN,
        unit: "people who went full-time",
        items: [
          { label: "Netherlands", count: 9, share: null, target: true },
          { label: "Other countries", count: 1, share: null, remainder: true },
        ],
        caption: "Too few people to compare countries.",
      },
      evidence_ids: ["ev_cmt_2"],
    },
  ],
  next_steps: [
    {
      label: "See your Internship-to-Job chances in the Netherlands",
      tool: "internship_chances",
      params: { country: "Netherlands" },
    },
  ],
  warnings: ["Example data (mock mode)", "Fewer than 10 people per company, so no company has a percentage."],
  evidence: [
    evidence("ev_cmt_1", "/person/search", 41, 41, { school: "VIT Vellore", country: "Netherlands" }),
    evidence("ev_cmt_2", "/person/search", 41, 41, { group_by: "company", min_row_size: 5 }),
  ],
};
