import { makeCount } from "@/lib/count";
import type {
  Evidence,
  ResultEnvelope,
  RouteListItem,
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

const YOU = "You (VIT CSE + 2 yrs)";
const N = 168; // people in the goal position today

const routes: RouteListItem[] = [
  {
    id: "r1",
    title: "Master's in Germany, then a working-student role",
    steps: [
      { label: YOU, kind: "you" },
      { label: "MS Computer Science, Germany", kind: "degree", years: 2 },
      { label: "Working student, data team", kind: "role", years: 1 },
      { label: "Data Engineer, Berlin", kind: "goal", years: 1.5 },
    ],
    people: count(41, N, ["ev_gps_2"]),
    typical_years: 4.5,
    fit: "fits_you",
    gaps: [
      "A German master's offer (most seen here are TU or applied-science programs)",
      "Airflow or a similar workflow tool",
      "German at A2 helps in daily team life, though many teams work in English",
    ],
  },
  {
    id: "r2",
    title: "A data role in India first, then straight to Berlin",
    steps: [
      { label: YOU, kind: "you" },
      { label: "Data Engineer, India", kind: "role", years: 2 },
      { label: "Data Engineer, Berlin", kind: "goal", years: 1 },
    ],
    people: count(33, N, ["ev_gps_2"]),
    typical_years: 3,
    fit: "stretch",
    gaps: [
      "A data engineering title or a project you can point to (your Infosys role is systems engineering)",
      "dbt and a cloud warehouse such as Snowflake or BigQuery",
      "A job offer that meets the Blue Card salary threshold",
    ],
  },
  {
    id: "r3",
    title: "Master's in the UK or Netherlands, then move to Berlin",
    steps: [
      { label: YOU, kind: "you" },
      { label: "MSc Data Science, UK or Netherlands", kind: "degree", years: 1.5 },
      { label: "Data Engineer, Amsterdam or London", kind: "role", years: 2 },
      { label: "Data Engineer, Berlin", kind: "goal", years: 1 },
    ],
    people: count(24, N, ["ev_gps_2"]),
    typical_years: 4.5,
    fit: "fits_you",
    gaps: [
      "A one-year master's offer and the funds for it",
      "Kafka or another streaming tool",
      "One year of local work before moving on",
    ],
  },
  {
    id: "r4",
    title: "IT services in India, then a consulting move to Germany",
    steps: [
      { label: YOU, kind: "you" },
      { label: "IT services, India", kind: "role", years: 2 },
      { label: "Consultant, Germany", kind: "role", years: 1.5 },
      { label: "Data Engineer, Berlin", kind: "goal", years: 1 },
    ],
    people: count(19, N, ["ev_gps_2"]),
    typical_years: 4.5,
    fit: "far",
    gaps: [
      "An employer with a Germany office and an onsite programme",
      "Client-facing consulting experience",
      "AWS or Azure data certification",
    ],
  },
  {
    id: "r5",
    title: "Data analyst in India, then a step up to data engineering",
    steps: [
      { label: YOU, kind: "you" },
      { label: "Data Analyst, India", kind: "role", years: 2 },
      { label: "Data Engineer, Berlin", kind: "goal", years: 1.5 },
    ],
    people: count(14, N, ["ev_gps_2"]),
    typical_years: 3.5,
    fit: "stretch",
    gaps: [
      "Pipeline work beyond dashboards, for example Airflow DAGs you can show",
      "dbt",
      "A visa route that fits an analyst-to-engineer switch",
    ],
  },
];

const KEYWORDS = [
  { term: "Airflow", count: 118, you_have: false },
  { term: "dbt", count: 96, you_have: false },
  { term: "Kafka", count: 88, you_have: false },
  { term: "Snowflake", count: 79, you_have: false },
  { term: "Docker", count: 74, you_have: false },
  { term: "Terraform", count: 52, you_have: false },
  { term: "AWS", count: 112, you_have: false },
  { term: "Python", count: 156, you_have: true },
  { term: "SQL", count: 151, you_have: true },
  { term: "Apache Spark", count: 109, you_have: true },
].map((k) => ({ ...k, share: Math.round((k.count / N) * 1000) / 1000 }));

export const mockResult: ResultEnvelope = {
  tool: "reverse_gps",
  title: "How people reached Data Engineer in Berlin",
  summary:
    "Starting from a BTech in CSE and two years of work, the most common route to Data Engineer in Berlin runs through a master's in Germany and a working-student role, followed by a direct move from a data job in India. You already have Python, SQL and Spark, so the gaps are mostly workflow and cloud tools.",
  cohort: {
    definition: "Data Engineers working in Berlin whose first degree was a BTech or BE from an Indian college",
    filters: {
      goal: { role: "Data Engineer", city: "Berlin", country: "Germany", company: null },
      start: { school: "VIT Vellore", field: "Computer Science", years_experience: 2 },
    },
    n_visible: N,
    match_level: "field_only",
    widened: false,
    widened_reason: null,
  },
  confidence: "medium",
  coverage_note: `Based on ${N} visible Data Engineers in Berlin; people without public profiles are not counted, so each route is "at least". Routes can overlap, so they will not add up to ${N}.`,
  data_date: DATA_DATE,
  sections: [
    {
      id: "goal",
      kind: "text",
      title: "Goal as we understood it",
      data: { text: "Role: Data Engineer. City: Berlin. Country: Germany. Any company." },
    },
    {
      id: "routes_list",
      kind: "route_list",
      title: "Routes that fit you",
      data: {
        routes: routes,
        caption: "Ordered by how closely each route matches where you start. Counts are people who took the route.",
      },
      evidence_ids: ["ev_gps_2"],
    },
    {
      id: "routes_graph",
      kind: "routes",
      title: "All routes at a glance",
      data: {
        nodes: [
          { id: "you", label: YOU, kind: "you" },
          { id: "ms_de", label: "MS, Germany", kind: "degree" },
          { id: "ws", label: "Working student", kind: "role" },
          { id: "de_in", label: "Data Engineer, India", kind: "role" },
          { id: "ms_eu", label: "MSc, UK or Netherlands", kind: "degree" },
          { id: "de_eu", label: "Data Engineer, Amsterdam or London", kind: "role" },
          { id: "it_in", label: "IT services, India", kind: "role" },
          { id: "consult", label: "Consultant, Germany", kind: "role" },
          { id: "analyst_in", label: "Data Analyst, India", kind: "role" },
          { id: "goal", label: "Data Engineer, Berlin", kind: "goal" },
        ],
        edges: [
          { from: "you", to: "ms_de", count: 41 },
          { from: "ms_de", to: "ws", count: 41 },
          { from: "ws", to: "goal", count: 41 },
          { from: "you", to: "de_in", count: 33 },
          { from: "de_in", to: "goal", count: 33 },
          { from: "you", to: "ms_eu", count: 24 },
          { from: "ms_eu", to: "de_eu", count: 24 },
          { from: "de_eu", to: "goal", count: 24 },
          { from: "you", to: "it_in", count: 19 },
          { from: "it_in", to: "consult", count: 19 },
          { from: "consult", to: "goal", count: 19 },
          { from: "you", to: "analyst_in", count: 14 },
          { from: "analyst_in", to: "goal", count: 14 },
        ],
        caption: "Line weight is the number of people on that step.",
      },
      evidence_ids: ["ev_gps_2"],
    },
    {
      id: "skill_gaps",
      kind: "keywords",
      title: "Skills common in the role that you do not list yet",
      data: {
        n: N,
        items: KEYWORDS,
        caption: "Share of Data Engineers in Berlin who list the skill. Python, SQL and Spark are already on your profile.",
      },
      evidence_ids: ["ev_gps_3"],
    },
  ],
  next_steps: [
    {
      label: "See the employers, titles and schools behind Data Engineer in Berlin",
      tool: "routes_to_position",
      params: { role: "Data Engineer", city: "Berlin", country: "Germany" },
    },
    {
      label: "Check your internship-to-job chances in Germany",
      tool: "internship_chances",
      params: { role: "Data Engineer", country: "Germany" },
    },
  ],
  warnings: ["Example data (mock mode)"],
  evidence: [
    evidence("ev_gps_1", "/person/search", N, 168, { title: "Data Engineer", city: "Berlin" }),
    evidence("ev_gps_2", "/person/search", N, 168, { trace: "career_history", start_filters: "btech_india" }),
    evidence("ev_gps_3", "/person/search", N, 168, { aggregate: "skills" }),
  ],
};

/* ------------------------------------------------------------------ */
/* Thin: ML Engineer in Leipzig, widened to all of Germany             */
/* ------------------------------------------------------------------ */

const NT = 9;
export const mockResultThin: ResultEnvelope = {
  tool: "reverse_gps",
  title: "How people reached ML Engineer in Leipzig",
  summary:
    "Very few ML Engineers in Leipzig have public profiles, so we looked at ML Engineers across Germany. Two routes show up, each with only a few people. Think of them as hints about where to look next, not as a ranking.",
  cohort: {
    definition: "ML Engineers in Germany whose first degree was a BTech or BE from an Indian college",
    filters: {
      goal: { role: "ML Engineer", city: "Leipzig", country: "Germany", company: null },
      start: { school: "VIT Vellore", field: "Computer Science", years_experience: 2 },
    },
    n_visible: NT,
    match_level: "field_only",
    widened: true,
    widened_reason: "Only 3 people in Leipzig matched, so we widened from Leipzig to all of Germany.",
  },
  confidence: "low",
  coverage_note: `Based on ${NT} visible ML Engineers; far too few for percentages, so we show plain counts.`,
  data_date: DATA_DATE,
  sections: [
    {
      id: "goal",
      kind: "text",
      title: "Goal as we understood it",
      data: { text: "Role: ML Engineer. City: Leipzig, widened to Germany. Country: Germany. Any company." },
    },
    {
      id: "routes_list",
      kind: "route_list",
      title: "Routes that fit you",
      data: {
        routes: [
          {
            id: "t1",
            title: "Master's in Germany, then research assistant",
            steps: [
              { label: YOU, kind: "you" },
              { label: "MS Computer Science, Germany", kind: "degree", years: 2 },
              { label: "Research assistant, ML", kind: "role", years: 1 },
              { label: "ML Engineer, Germany", kind: "goal", years: 1 },
            ],
            people: count(4, NT, ["ev_gpst_1"]),
            typical_years: 4,
            fit: "fits_you",
            gaps: ["A master's offer with an ML focus", "PyTorch or TensorFlow projects you can show", "A published project or thesis"],
          },
          {
            id: "t2",
            title: "Data science in India, then a move",
            steps: [
              { label: YOU, kind: "you" },
              { label: "Data Scientist, India", kind: "role", years: 2 },
              { label: "ML Engineer, Germany", kind: "goal", years: 1 },
            ],
            people: count(3, NT, ["ev_gpst_1"]),
            typical_years: 3,
            fit: "stretch",
            gaps: ["A data science title (yours is systems engineering)", "Model deployment experience, for example with MLflow"],
          },
        ],
        caption: "Only two routes had enough people to show.",
      },
      evidence_ids: ["ev_gpst_1"],
    },
    {
      id: "skill_gaps",
      kind: "keywords",
      title: "Skills common in the role that you do not list yet",
      data: {
        n: NT,
        items: [
          { term: "PyTorch", count: 7, share: null, you_have: false },
          { term: "Docker", count: 5, share: null, you_have: false },
          { term: "MLflow", count: 4, share: null, you_have: false },
          { term: "Python", count: 9, share: null, you_have: true },
        ],
        caption: "Counts of the 9 people we could see. Too few for shares.",
      },
      evidence_ids: ["ev_gpst_1"],
    },
  ],
  next_steps: [
    {
      label: "Try the wider goal: ML Engineer in Germany",
      tool: "reverse_gps",
      params: { goal_text: "ML Engineer in Germany" },
    },
  ],
  warnings: ["Example data (mock mode)", "Fewer than 10 people matched, so no route has a percentage."],
  evidence: [evidence("ev_gpst_1", "/person/search", 9, 9, { title: "ML Engineer", country: "Germany" })],
};
