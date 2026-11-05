import type { Count, Evidence, ResultEnvelope } from "@/lib/types";

/**
 * Example results for Riya Menon (BTech CSE, VIT Vellore 2022, 2 years at Infosys,
 * aiming for a data role in Germany). Made up for layout and testing.
 */

const FETCHED = "2026-11-06T09:52:00Z";
const EX = "Example data (mock mode)";

function count(k: number, n: number, evidence_ids: string[] = ["ev_jp_postings"]): Count {
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
    id: "ev_jp_postings",
    endpoint: "/job/search",
    filters: { title: "Data Engineer", city: "Berlin", country: "Germany", posted_within_days: 90 },
    total_count: 412,
    results_used: 412,
    fetched_at: FETCHED,
    source: "mock",
    note: "Example data: all 412 postings of the last 90 days were read",
  },
  {
    id: "ev_jp_hires",
    endpoint: "/person/search",
    filters: { current_title: "Data Engineer", current_city: "Berlin", started_within_months: 12 },
    total_count: 96,
    results_used: 96,
    fetched_at: FETCHED,
    source: "mock",
    note: "Example data: people who started as Data Engineers at these employers in the last 12 months",
  },
];

const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const entry = [14, 15, 12, 16, 19, 22];
const mid = [62, 66, 57, 63, 72, 79];
const senior = [42, 43, 40, 42, 48, 51];

type Row = { employer: string; postings: number; hires: number; signal: string[] };
const employers: Row[] = [
  { employer: "Zalando", postings: 31, hires: 12, signal: ["High"] },
  { employer: "Delivery Hero", postings: 27, hires: 9, signal: ["High"] },
  { employer: "N26", postings: 19, hires: 2, signal: ["Some"] },
  { employer: "HelloFresh", postings: 17, hires: 3, signal: ["Some"] },
  { employer: "SAP", postings: 14, hires: 4, signal: ["Some"] },
  { employer: "Celonis", postings: 12, hires: 3, signal: ["Some"] },
  { employer: "GetYourGuide", postings: 11, hires: 0, signal: ["Unclear"] },
  { employer: "Trade Republic", postings: 9, hires: 0, signal: ["Unclear"] },
];

export const mockResult: ResultEnvelope = {
  tool: "job_postings",
  title: "Data Engineer postings in Berlin",
  summary:
    "Riya, Berlin has 412 open Data Engineer postings from the last 90 days, about one in five more than the 90 days before. More than half ask for English only, and at least 71 mention visa sponsorship. Zalando and Delivery Hero have also hired people like you from similar postings.",
  cohort: null,
  confidence: "medium",
  coverage_note:
    "Based on 412 postings found for Data Engineer in Berlin in the last 90 days. Postings that were removed early or never listed publicly are not counted.",
  data_date: "2026-11-06",
  sections: [
    {
      id: "open_90",
      kind: "stat",
      title: "Open postings",
      evidence_ids: ["ev_jp_postings"],
      data: { label: "postings in the last 90 days", value: 412, unit: "postings", note: "Up from 346 in the 90 days before that" },
    },
    {
      id: "open_30",
      kind: "stat",
      title: "Open postings, last 30 days",
      evidence_ids: ["ev_jp_postings"],
      data: { label: "postings in the last 30 days", value: 141, unit: "postings" },
    },
    {
      id: "open_prev",
      kind: "stat",
      title: "The 90 days before",
      evidence_ids: ["ev_jp_postings"],
      data: { label: "postings in the previous 90 days", value: 346, unit: "postings" },
    },
    {
      id: "trend",
      kind: "timeseries",
      title: "Postings by month",
      evidence_ids: ["ev_jp_postings"],
      data: {
        unit: "postings",
        caption: "Postings first seen each month, split by seniority. Each cell is 10 postings.",
        series: [
          { key: "entry", label: "Entry", points: months.map((period, i) => ({ period, value: entry[i] })) },
          { key: "mid", label: "Mid", points: months.map((period, i) => ({ period, value: mid[i] })) },
          { key: "senior", label: "Senior and lead", points: months.map((period, i) => ({ period, value: senior[i] })) },
        ],
      },
    },
    {
      id: "seniority",
      kind: "distribution",
      title: "Seniority asked for",
      evidence_ids: ["ev_jp_postings"],
      data: {
        n: 412,
        unit: "postings",
        items: [
          { label: "Entry", count: 58, share: 58 / 412 },
          { label: "Mid", count: 214, share: 214 / 412, target: true },
          { label: "Senior", count: 118, share: 118 / 412 },
          { label: "Lead", count: 22, share: 22 / 412 },
        ],
      },
    },
    {
      id: "languages",
      kind: "distribution",
      title: "Which languages the job asks for",
      evidence_ids: ["ev_jp_postings"],
      data: {
        n: 412,
        unit: "postings",
        caption: "English only means the posting does not ask for another language.",
        items: [
          { label: "English only", count: 231, share: 231 / 412, target: true },
          { label: "German required", count: 148, share: 148 / 412 },
          { label: "Other language or not stated", count: 33, share: 33 / 412, remainder: true },
        ],
      },
    },
    {
      id: "visa",
      kind: "stat",
      title: "Visa sponsorship",
      evidence_ids: ["ev_jp_postings"],
      data: { label: "postings mention visa sponsorship or relocation help", count: count(71, 412) },
    },
    {
      id: "skills",
      kind: "keywords",
      title: "Skills in demand",
      evidence_ids: ["ev_jp_postings"],
      data: {
        n: 412,
        caption: "Share of postings that name the skill.",
        items: [
          { term: "SQL", count: 331, share: 331 / 412, you_have: true },
          { term: "Python", count: 317, share: 317 / 412, you_have: true },
          { term: "Apache Spark", count: 202, share: 202 / 412, you_have: true },
          { term: "AWS", count: 177, share: 177 / 412 },
          { term: "Airflow", count: 160, share: 160 / 412 },
          { term: "dbt", count: 119, share: 119 / 412 },
          { term: "Kafka", count: 99, share: 99 / 412 },
          { term: "Kubernetes", count: 87, share: 87 / 412 },
          { term: "Snowflake", count: 82, share: 82 / 412 },
        ],
      },
    },
    {
      id: "employers",
      kind: "ranked_table",
      title: "Who posts the most",
      evidence_ids: ["ev_jp_postings", "ev_jp_hires"],
      data: {
        n: 412,
        caption: "Hire-through compares each employer's postings with people who later started in the same role there.",
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "postings", label: "Postings", type: "int", bar: true },
          { key: "hires", label: "Matching hires seen", type: "int" },
          { key: "signal", label: "Hire-through", type: "badges" },
        ],
        rows: [
          ...employers.map((e) => ({ cells: { ...e }, badges: e.signal })),
          { cells: { employer: "Other employers", postings: 272, hires: 41, signal: [] as string[] }, rest: true },
        ],
        default_sort: { key: "postings", dir: "desc" },
      },
    },
    {
      id: "method",
      kind: "text",
      title: "How to read hire-through",
      data: {
        text: "High means that for about a third or more of an employer's postings we also see someone who started in that role there in the last 12 months. Some means one in ten or more. Unclear means no matching hires seen yet, which can also mean the hires simply do not have public profiles. It is a hint, not a verdict.",
      },
    },
  ],
  next_steps: [
    {
      label: "See how crowded Data Engineer is in Berlin",
      tool: "market_saturation",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
  ],
  warnings: [EX, "Postings can be reposted, so a few may be counted more than once."],
  evidence,
};

/* ---- thin result: a smaller city ---- */

export const mockResultThin: ResultEnvelope = {
  tool: "job_postings",
  title: "Data Engineer postings in Leipzig",
  summary:
    "Only 9 Data Engineer postings turned up in Leipzig in the last 90 days, too few to show a trend or a typical skill list. The numbers below are counts, not shares. Try the whole of Germany for a fuller picture.",
  cohort: null,
  confidence: "low",
  coverage_note: "Based on 9 postings found for Data Engineer in Leipzig in the last 90 days. Too few to compare.",
  data_date: "2026-11-06",
  sections: [
    {
      id: "open_90",
      kind: "stat",
      title: "Open postings",
      evidence_ids: ["ev_jp_thin"],
      data: { label: "postings in the last 90 days", value: 9, unit: "postings", note: "6 in the 90 days before that" },
    },
    {
      id: "open_30",
      kind: "stat",
      title: "Open postings, last 30 days",
      evidence_ids: ["ev_jp_thin"],
      data: { label: "postings in the last 30 days", value: 4, unit: "postings" },
    },
    {
      id: "open_prev",
      kind: "stat",
      title: "The 90 days before",
      evidence_ids: ["ev_jp_thin"],
      data: { label: "postings in the previous 90 days", value: 6, unit: "postings" },
    },
    {
      id: "trend",
      kind: "timeseries",
      title: "Postings by month",
      evidence_ids: ["ev_jp_thin"],
      data: {
        unit: "postings",
        series: [
          { key: "entry", label: "Entry", points: ["2026-08", "2026-09", "2026-10"].map((period, i) => ({ period, value: [0, 1, 1][i] })) },
          { key: "mid", label: "Mid", points: ["2026-08", "2026-09", "2026-10"].map((period, i) => ({ period, value: [1, 2, 3][i] })) },
          { key: "senior", label: "Senior and lead", points: ["2026-08", "2026-09", "2026-10"].map((period, i) => ({ period, value: [0, 1, 1][i] })) },
        ],
      },
    },
    {
      id: "seniority",
      kind: "distribution",
      title: "Seniority asked for",
      evidence_ids: ["ev_jp_thin"],
      data: { n: 9, unit: "postings", items: [{ label: "Entry", count: 2 }, { label: "Mid", count: 6 }, { label: "Senior", count: 1 }] },
    },
    {
      id: "languages",
      kind: "distribution",
      title: "Which languages the job asks for",
      evidence_ids: ["ev_jp_thin"],
      data: {
        n: 9,
        unit: "postings",
        items: [
          { label: "English only", count: 5 },
          { label: "German required", count: 3 },
          { label: "Other language or not stated", count: 1, remainder: true },
        ],
      },
    },
    {
      id: "visa",
      kind: "stat",
      title: "Visa sponsorship",
      evidence_ids: ["ev_jp_thin"],
      data: { label: "postings mention visa sponsorship or relocation help", count: count(1, 9, ["ev_jp_thin"]) },
    },
    {
      id: "skills",
      kind: "keywords",
      title: "Skills in demand",
      evidence_ids: ["ev_jp_thin"],
      data: {
        n: 9,
        items: [
          { term: "SQL", count: 8 },
          { term: "Python", count: 7 },
          { term: "Apache Spark", count: 4 },
          { term: "Airflow", count: 3 },
        ],
      },
    },
    {
      id: "employers",
      kind: "ranked_table",
      title: "Who posts the most",
      evidence_ids: ["ev_jp_thin"],
      data: {
        n: 9,
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "postings", label: "Postings", type: "int", bar: true },
          { key: "hires", label: "Matching hires seen", type: "int" },
          { key: "signal", label: "Hire-through", type: "badges" },
        ],
        rows: [
          { cells: { employer: "Employers with 1 posting", postings: 9, hires: 0, signal: [] as string[] }, rest: true },
        ],
      },
    },
  ],
  next_steps: [
    {
      label: "Widen to all of Germany",
      tool: "job_postings",
      params: { role: "Data Engineer", country: "Germany" },
    },
  ],
  warnings: [EX, "With only 9 postings, individual employers are not listed. Few postings is not a bad sign for you, only a small sample."],
  evidence: [
    {
      id: "ev_jp_thin",
      endpoint: "/job/search",
      filters: { title: "Data Engineer", city: "Leipzig", country: "Germany", posted_within_days: 90 },
      total_count: 9,
      results_used: 9,
      fetched_at: FETCHED,
      source: "mock",
      note: "Example data: all 9 postings of the last 90 days were read",
    },
  ],
};
