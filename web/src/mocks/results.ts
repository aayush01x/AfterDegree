import { makeCount } from "@/lib/count";
import type {
  Cohort,
  DistributionItem,
  Evidence,
  Goals,
  ResultEnvelope,
  Section,
  ToolId,
} from "@/lib/types";

const DATA_DATE = "2026-11-06";
const FETCHED = "2026-11-06T09:52:00Z";

export const count = makeCount;

const ev = (id: string, endpoint: string, total: number, used: number, filters: Record<string, unknown>, note?: string): Evidence => ({
  id,
  endpoint,
  filters,
  total_count: total,
  results_used: used,
  fetched_at: FETCHED,
  source: "mock",
  note: note ?? `Example data: sampled ${used} of ${total} matching records`,
});

interface Ctx {
  goals: Goals;
  params: Record<string, unknown>;
  university: boolean;
}

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

function envelope(tool: ToolId, partial: Partial<ResultEnvelope> & Pick<ResultEnvelope, "title" | "sections">): ResultEnvelope {
  return {
    tool,
    summary: null,
    cohort: null,
    confidence: "medium",
    coverage_note: "Example data. People without public profiles are not counted.",
    data_date: DATA_DATE,
    next_steps: [],
    warnings: [],
    evidence: [],
    ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* People like me                                                      */
/* ------------------------------------------------------------------ */

const BASE_COUNTRIES: [string, number][] = [
  ["Germany", 71],
  ["United States", 58],
  ["United Kingdom", 34],
  ["Canada", 27],
  ["Netherlands", 15],
  ["Other countries", 9],
];
const BASE_HOME = 98;

function peopleLikeMe({ goals, params, university }: Ctx): ResultEnvelope {
  const match = str(params.match, "exact_school");
  const band = Array.isArray(params.exp_band) ? (params.exp_band as number[]) : null;
  const thin = band ? band[1] - band[0] < 1 : false;
  const scale = thin ? 7 / 312 : match === "school_tier" ? 486 / 312 : match === "field_only" ? 1920 / 312 : 1;
  const target = goals.target_countries[0] ?? "Germany";

  const abroad = BASE_COUNTRIES.map(([label, c]) => ({ label, count: Math.max(thin ? 0 : 1, Math.round(c * scale)) }));
  const home = Math.max(1, Math.round(BASE_HOME * scale));
  const trimmed = thin ? [{ label: "Germany", count: 2 }, { label: "United States", count: 1 }, { label: "Netherlands", count: 1 }] : abroad;
  const homeCount = thin ? 3 : home;
  const n = trimmed.reduce((s, i) => s + i.count, 0) + homeCount;
  const nAbroad = n - homeCount;

  const items: DistributionItem[] = trimmed
    .map((i) => ({ ...i, share: i.count / n, target: !university && i.label === target }))
    .sort((a, b) => Number(b.target) - Number(a.target) || b.count - a.count);
  items.sort((a, b) => (a.label === "Other countries" ? 1 : b.label === "Other countries" ? -1 : 0));
  items.push({ label: "Still in India", count: homeCount, share: homeCount / n, remainder: true });

  const targetCount = items.find((i) => i.target)?.count ?? 0;
  const s = (x: number) => Math.round(x * scale);

  const cohortDef = university
    ? "BTech graduates of VIT Vellore, classes of 2020–2024"
    : match === "field_only"
      ? "BTech CSE graduates of any Indian college (2020–2024) with 1–3 years of work"
      : match === "school_tier"
        ? "BTech CSE graduates of private tier-1 colleges (2020–2024) with 1–3 years of work"
        : thin
          ? `BTech CSE graduates of VIT Vellore (2020–2024) with ${band![0]}–${band![1]} years of work`
          : "BTech CSE graduates of VIT Vellore (2020–2024) with 1–3 years of work";

  const cohort: Cohort = {
    definition: cohortDef,
    filters: { school: university ? "VIT Vellore" : match === "exact_school" ? "VIT Vellore" : match, degree: "BTech", field: "Computer Science", graduation_years: [2020, 2024], exp_band: band ?? [1, 3] },
    n_visible: n,
    match_level: match as Cohort["match_level"],
    widened: false,
    widened_reason: null,
  };

  const evs = [
    ev("ev_plm_search", "/person/search", n, Math.min(n, 200), cohort.filters),
    ev("ev_plm_degrees", "/person/search", n, Math.min(n, 200), { ...cohort.filters, has_postgrad: true }),
  ];

  const roleRows: [string, number][] = [
    ["Data Engineer", 38],
    ["Data Scientist", 31],
    ["Software Engineer", 29],
    ["Data Analyst", 22],
    ["ML Engineer", 14],
  ];
  const employerRows: [string, number][] = [
    ["SAP", 9],
    ["Zalando", 7],
    ["Siemens", 6],
    ["Delivery Hero", 5],
  ];

  const sections: Section[] = [
    { id: "cohort_size", kind: "stat", title: university ? "Your graduates" : "People like you", data: { label: "visible profiles", value: n }, evidence_ids: ["ev_plm_search"] },
    {
      id: "moved_abroad",
      kind: "stat",
      title: "Moved abroad",
      data: { label: university ? "your graduates now work outside India" : "people like you now work outside India", count: count(nAbroad, n, ["ev_plm_search"]) },
      evidence_ids: ["ev_plm_search"],
    },
    {
      id: "countries",
      kind: "distribution",
      title: university ? `Where your ${n} graduates are now` : `Where the ${n} are now`,
      data: { n, unit: "people", items, caption: university ? "Each square is one graduate. Abroad first." : "Each square is one person like you. Abroad first; your target is highlighted." },
      evidence_ids: ["ev_plm_search"],
    },
    {
      id: "roles",
      kind: "ranked_table",
      title: "What they do now",
      data: {
        n: nAbroad,
        caption: "abroad",
        columns: [
          { key: "role", label: "Role", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: thin
          ? [{ cells: { role: "Data Engineer", people: 2 } }, { cells: { role: "Other roles", people: 2 }, rest: true }]
          : [
              ...roleRows.map(([role, c]) => ({ cells: { role, people: s(c) }, you: !university && role === goals.target_roles[0] })),
              { cells: { role: "Other roles", people: nAbroad - roleRows.reduce((a, [, c]) => a + s(c), 0) }, rest: true },
            ],
      },
      evidence_ids: ["ev_plm_search"],
    },
    {
      id: "employers_target",
      kind: "ranked_table",
      title: `Employers in ${target}`,
      data: {
        n: targetCount,
        columns: [
          { key: "employer", label: "Employer", type: "text" },
          { key: "people", label: "People", type: "int", bar: true },
        ],
        rows: thin
          ? [{ cells: { employer: "Employers with fewer than 5 people", people: 2 }, rest: true }]
          : [
              ...employerRows.map(([employer, c]) => ({ cells: { employer, people: s(c) } })),
              { cells: { employer: "At other employers", people: targetCount - employerRows.reduce((a, [, c]) => a + s(c), 0) }, rest: true },
            ],
      },
      evidence_ids: ["ev_plm_search"],
    },
    {
      id: "further_degrees",
      kind: "distribution",
      title: "Further degrees",
      data: {
        n,
        unit: "degrees",
        items: thin
          ? [{ label: "MS / MSc", count: 3 }, { label: "No further degree shown", count: 4, remainder: true }]
          : [
              { label: "MS / MSc", count: s(121) },
              { label: "MBA", count: s(8) },
              { label: "PhD", count: s(6) },
              { label: "No further degree shown", count: n - s(121) - s(8) - s(6), remainder: true },
            ],
        caption: "A master's is by far the most common step. Most of the rest show no further degree on their profile.",
      },
      evidence_ids: ["ev_plm_degrees"],
    },
    {
      id: "degree_countries",
      kind: "distribution",
      title: "Where they studied",
      data: {
        n: thin ? 3 : s(121),
        unit: "people",
        items: thin
          ? [{ label: "Germany", count: 2 }, { label: "United States", count: 1 }]
          : [
              { label: "Germany", count: s(46), target: !university && target === "Germany" },
              { label: "United States", count: s(38) },
              { label: "United Kingdom", count: s(21) },
              { label: "Canada", count: s(9) },
              { label: "Other countries", count: s(7) },
            ],
        caption: "Country of the master's, for those who took one.",
      },
      evidence_ids: ["ev_plm_degrees"],
    },
  ];

  return envelope("people_like_me", {
    title: university ? "Where your graduates are now" : "Where people like you are now",
    summary: thin
      ? "Only a handful of people match a band this narrow, so treat these as stories, not odds. Widening the experience band gives a fairer picture."
      : university
        ? `Most of your recent CSE graduates who left India went to Germany or the United States, and a master's was the usual first step.`
        : `Of the ${n} people with your background we can see, at least ${nAbroad} now work outside India. ${target} is the most common destination, and most of them did a master's there first.`,
    cohort,
    confidence: thin ? "low" : n > 200 ? "high" : "medium",
    coverage_note: `Example data. Based on ${n} visible profiles; 81% show a current country, so every count is "at least". People without public profiles are not counted.`,
    sections,
    next_steps: university
      ? [{ label: "See how your graduates' internships convert", tool: "conversion_map", params: { scope: { school: "VIT Vellore" } } }]
      : [{ label: `See your Internship-to-Job chances in ${target}`, tool: "internship_chances", params: { country: target } }],
    warnings: thin ? ["Fewer than 10 people match. Shares are hidden and the counts are shown as examples, not odds."] : [],
    evidence: evs,
  });
}

/* ------------------------------------------------------------------ */
/* The other seven tools                                               */
/* ------------------------------------------------------------------ */

function internshipChances({ goals, params }: Ctx): ResultEnvelope {
  const country = str(params.country, goals.target_countries[0] ?? "Germany");
  const e = [ev("ev_ic_interns", "/person/search", 37, 37, { country, title_contains: ["intern", "working student"] })];
  return envelope("internship_chances", {
    title: `Internship-to-job chances in ${country}`,
    summary: `Among people like you who interned or worked as students in ${country}, at least 24 of 37 later went full-time at the same company. That is a good sign, but the range is wide, so treat it as "more often than not", not a promise.`,
    confidence: "medium",
    coverage_note: "Example data. Based on 37 visible internships; a conversion counts only when the same company appears as a full-time role afterwards.",
    sections: [
      { id: "chance", kind: "stat", title: "Your chance", data: { label: "interns and working students later went full-time at the same company", count: count(24, 37, ["ev_ic_interns"]) } },
      {
        id: "companies",
        kind: "ranked_table",
        title: "Companies by conversion",
        data: {
          n: 37,
          columns: [
            { key: "company", label: "Company", type: "text" },
            { key: "interns", label: "Interns", type: "int" },
            { key: "converted", label: "Went full-time", type: "count", bar: true },
          ],
          rows: [
            { cells: { company: "Bosch", interns: 14, converted: count(9, 14) } },
            { cells: { company: "SAP", interns: 11, converted: count(8, 11) } },
            { cells: { company: "Siemens", interns: 6, converted: count(4, 6) } },
            { cells: { company: "Other companies", interns: 6, converted: count(3, 6) }, rest: true },
          ],
          default_sort: { key: "converted", dir: "desc" },
        },
      },
      { id: "method", kind: "text", title: "How this was computed", data: { text: "We found people like you whose profiles show an internship or working-student role, then checked whether the same company appears as a full-time role straight afterwards. Gaps of up to six months still count." } },
    ],
    next_steps: [{ label: `See which employers in ${country} hire Indian-educated people`, tool: "indian_friendly", params: { country } }],
    evidence: e,
  });
}

function conversionMap({ params }: Ctx): ResultEnvelope {
  const scope = (params.scope as Record<string, string>) ?? {};
  const country = scope.country ?? "Germany";
  return envelope("conversion_map", {
    title: `Intern-to-job conversion${scope.country ? ` in ${scope.country}` : ""}`,
    summary: "Large employers with structured intern programs convert most often. Small counts are shown but not ranked as percentages.",
    coverage_note: "Example data. Based on 412 visible internships in the scope you chose.",
    sections: [
      {
        id: "companies",
        kind: "ranked_table",
        title: "Companies ranked by conversion",
        data: {
          n: 412,
          columns: [
            { key: "company", label: "Company", type: "text" },
            { key: "interns", label: "Interns seen", type: "int" },
            { key: "converted", label: "Converted", type: "int" },
            { key: "rate", label: "Conversion", type: "count", bar: true },
          ],
          rows: [
            { cells: { company: "Bosch", interns: 58, converted: 37, rate: count(37, 58) } },
            { cells: { company: "SAP", interns: 64, converted: 39, rate: count(39, 64) } },
            { cells: { company: "Siemens", interns: 41, converted: 22, rate: count(22, 41) } },
            { cells: { company: "BMW Group", interns: 33, converted: 15, rate: count(15, 33) } },
            { cells: { company: "Zalando", interns: 19, converted: 8, rate: count(8, 19) } },
            { cells: { company: "Infineon", interns: 8, converted: 5, rate: count(5, 8) } },
            { cells: { company: "Other companies", interns: 189, converted: 71, rate: count(71, 189) }, rest: true },
          ],
          default_sort: { key: "rate", dir: "desc" },
        },
      },
      {
        id: "by_country",
        kind: "distribution",
        title: "Conversions by country",
        data: {
          n: 197,
          unit: "conversions",
          items: [
            { label: country, count: 121, target: true },
            { label: "Netherlands", count: 38 },
            { label: "Ireland", count: 22 },
            { label: "Other countries", count: 16 },
          ],
        },
      },
    ],
    next_steps: [{ label: "See your own chances at these companies", tool: "internship_chances", params: { country } }],
    evidence: [ev("ev_cm", "/person/search", 412, 200, scope)],
  });
}

function reverseGps({ params, goals }: Ctx): ResultEnvelope {
  const goal = str(params.goal_text, `${goals.target_roles[0] ?? "Data Engineer"} in ${goals.target_cities[0] ?? "Berlin"}`);
  return envelope("reverse_gps", {
    title: `Routes to ${goal}`,
    summary: "Most people in this position came through a German master's followed by a working-student role. Your Spark and SQL experience covers the core; cloud data tooling is the main gap.",
    coverage_note: "Example data. Based on 268 people in this position today with visible histories.",
    sections: [
      { id: "goal", kind: "text", title: "Your goal, as we read it", data: { text: `Role: Data Engineer · City: Berlin · Country: Germany. Starting point: BTech CSE, about 2 years of work in India.` } },
      {
        id: "routes",
        kind: "route_list",
        title: "Routes that fit your starting point",
        data: {
          routes: [
            {
              id: "r1",
              title: "Master's, then working student",
              steps: [{ label: "BTech in India" }, { label: "MSc in Germany", years: 2 }, { label: "Working student", years: 1 }, { label: "Data Engineer, Berlin" }],
              people: count(71, 268),
              typical_years: 3.5,
              fit: "fits_you",
              gaps: ["German at B1 helps for working-student roles", "A cloud data certificate (AWS or GCP)"],
            },
            {
              id: "r2",
              title: "Direct move with an employer",
              steps: [{ label: "BTech in India" }, { label: "Data role in India", years: 3 }, { label: "Data Engineer, Berlin" }],
              people: count(46, 268),
              typical_years: 4,
              fit: "stretch",
              gaps: ["About 1 more year in a data engineering title", "Airflow or dbt in production"],
            },
            {
              id: "r3",
              title: "Intra-company transfer",
              steps: [{ label: "BTech in India" }, { label: "Indian IT services", years: 4 }, { label: "Same employer, Germany" }, { label: "Data Engineer, Berlin", years: 2 }],
              people: count(19, 268),
              typical_years: 6,
              fit: "far",
              gaps: ["Few transfers from your current employer are visible"],
            },
          ],
        },
      },
      {
        id: "graph",
        kind: "routes",
        title: "How the routes connect",
        data: {
          nodes: [
            { id: "a", label: "BTech in India", kind: "start" },
            { id: "b", label: "MSc in Germany", kind: "degree" },
            { id: "c", label: "Data role in India", kind: "role" },
            { id: "d", label: "Working student", kind: "role" },
            { id: "e", label: "Data Engineer, Berlin", kind: "goal" },
          ],
          edges: [
            { from: "a", to: "b", count: 96 },
            { from: "a", to: "c", count: 64 },
            { from: "b", to: "d", count: 71 },
            { from: "b", to: "e", count: 25 },
            { from: "d", to: "e", count: 71 },
            { from: "c", to: "e", count: 46 },
          ],
        },
      },
      {
        id: "skills_gap",
        kind: "keywords",
        title: "Skills common in this role",
        data: {
          n: 268,
          caption: "Filled squares are skills already on your profile.",
          items: [
            { term: "SQL", count: 221, share: 0.82, you_have: true },
            { term: "Python", count: 214, share: 0.8, you_have: true },
            { term: "Apache Spark", count: 151, share: 0.56, you_have: true },
            { term: "Airflow", count: 128, share: 0.48 },
            { term: "AWS", count: 119, share: 0.44 },
            { term: "dbt", count: 87, share: 0.32 },
            { term: "Kafka", count: 74, share: 0.28 },
            { term: "German", count: 52, share: 0.19 },
          ],
        },
      },
    ],
    next_steps: [{ label: "See who hires into this role and from where", tool: "routes_to_position", params: { role: "Data Engineer", city: "Berlin", country: "Germany" } }],
    evidence: [ev("ev_rg", "/person/search", 268, 200, { title: "Data Engineer", city: "Berlin" })],
  });
}

function routesToPosition({ params }: Ctx): ResultEnvelope {
  const role = str(params.role, "Data Engineer");
  const place = str(params.city, str(params.country, "Germany"));
  return envelope("routes_to_position", {
    title: `How people became ${role} in ${place}`,
    coverage_note: "Example data. Based on 268 people in this position with visible histories.",
    sections: [
      {
        id: "graph",
        kind: "routes",
        title: "Entry routes",
        data: {
          nodes: [
            { id: "f1", label: "Indian IT services", kind: "employer" },
            { id: "f2", label: "German universities", kind: "school" },
            { id: "f3", label: "Startups in Germany", kind: "employer" },
            { id: "t1", label: "Working student", kind: "title" },
            { id: "t2", label: "Software Engineer", kind: "title" },
            { id: "p", label: `${role}, ${place}`, kind: "goal" },
          ],
          edges: [
            { from: "f2", to: "t1", count: 88 },
            { from: "f1", to: "t2", count: 52 },
            { from: "f3", to: "t2", count: 31 },
            { from: "t1", to: "p", count: 88 },
            { from: "t2", to: "p", count: 83 },
          ],
        },
      },
      {
        id: "feeders",
        kind: "ranked_table",
        title: "Feeder employers",
        data: { n: 268, columns: [{ key: "employer", label: "Employer", type: "text" }, { key: "people", label: "People", type: "int", bar: true }], rows: [
          { cells: { employer: "Infosys", people: 21 }, you: true },
          { cells: { employer: "TCS", people: 18 } },
          { cells: { employer: "Accenture", people: 14 } },
          { cells: { employer: "Wipro", people: 9 } },
          { cells: { employer: "Other employers", people: 206 }, rest: true },
        ] },
      },
      {
        id: "titles",
        kind: "ranked_table",
        title: "Previous titles",
        data: { n: 268, columns: [{ key: "title", label: "Title", type: "text" }, { key: "people", label: "People", type: "int", bar: true }], rows: [
          { cells: { title: "Working Student, Data", people: 88 } },
          { cells: { title: "Software Engineer", people: 61 } },
          { cells: { title: "Data Analyst", people: 37 } },
          { cells: { title: "Other titles", people: 82 }, rest: true },
        ] },
      },
      {
        id: "schools",
        kind: "ranked_table",
        title: "Schools and degrees",
        data: { n: 268, columns: [{ key: "school", label: "School and degree", type: "text" }, { key: "people", label: "People", type: "int", bar: true }], rows: [
          { cells: { school: "TU Munich, MSc", people: 24 } },
          { cells: { school: "TU Berlin, MSc", people: 19 } },
          { cells: { school: "RWTH Aachen, MSc", people: 15 } },
          { cells: { school: "Other schools", people: 210 }, rest: true },
        ] },
      },
      {
        id: "years",
        kind: "distribution",
        title: "Years of experience at entry",
        data: { n: 268, unit: "people", items: [
          { label: "Under 1 year", count: 41 },
          { label: "1–2 years", count: 96 },
          { label: "3–5 years", count: 88 },
          { label: "6+ years", count: 43 },
        ] },
      },
    ],
    next_steps: [{ label: `See what current ${role} postings ask for`, tool: "job_postings", params: { role, country: "Germany" } }],
    evidence: [ev("ev_rp", "/person/search", 268, 200, { title: role, location: place })],
  });
}

function jobPostings({ params }: Ctx): ResultEnvelope {
  const role = str(params.role, "Data Engineer");
  const country = str(params.country, "Germany");
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const vals = [412, 398, 377, 405, 441, 463];
  return envelope("job_postings", {
    title: `${role} postings in ${country}`,
    summary: "Postings are edging up. Most ask for English only, and about one in five mention visa sponsorship.",
    coverage_note: "Example data. Based on 1,284 postings found in the last 90 days.",
    sections: [
      { id: "open", kind: "stat", title: "Open postings", data: { label: "postings in the last 30 days", value: 463, note: "1,284 in the last 90 days" } },
      { id: "trend", kind: "timeseries", title: "Postings by month", data: { unit: "postings", points: months.map((period, i) => ({ period, value: vals[i] })) } },
      { id: "seniority", kind: "distribution", title: "Seniority", data: { n: 1284, unit: "postings", items: [
        { label: "Entry", count: 192 }, { label: "Mid", count: 611 }, { label: "Senior", count: 398 }, { label: "Lead", count: 83 },
      ] } },
      { id: "skills", kind: "keywords", title: "Skills in demand", data: { n: 1284, items: [
        { term: "SQL", count: 1002, share: 0.78 }, { term: "Python", count: 950, share: 0.74 }, { term: "Spark", count: 616, share: 0.48 },
        { term: "AWS", count: 539, share: 0.42 }, { term: "Airflow", count: 475, share: 0.37 }, { term: "dbt", count: 334, share: 0.26 },
      ] } },
      { id: "languages", kind: "distribution", title: "Language requirements", data: { n: 1284, unit: "postings", items: [
        { label: "English only", count: 822 }, { label: "German required", count: 398 }, { label: "Not stated", count: 64, remainder: true },
      ] } },
      { id: "visa", kind: "stat", title: "Visa sponsorship", data: { label: "postings mention visa sponsorship", count: count(244, 1284) } },
      { id: "employers", kind: "ranked_table", title: "Employers posting most", data: { n: 1284, columns: [
        { key: "employer", label: "Employer", type: "text" },
        { key: "postings", label: "Postings", type: "int", bar: true },
        { key: "hires", label: "Matching hires", type: "int" },
        { key: "signal", label: "Hire-through", type: "badges" },
      ], rows: [
        { cells: { employer: "Zalando", postings: 41, hires: 18, signal: ["Hires seen"] } },
        { cells: { employer: "Delivery Hero", postings: 37, hires: 15, signal: ["Hires seen"] } },
        { cells: { employer: "N26", postings: 22, hires: 2, signal: ["Few hires seen"] } },
        { cells: { employer: "Other employers", postings: 1184, hires: 301, signal: [] }, rest: true },
      ] } },
    ],
    next_steps: [{ label: `See how crowded ${role} is in ${country}`, tool: "market_saturation", params: { role, country } }],
    evidence: [ev("ev_jp", "/job/search", 1284, 1284, { title: role, country })],
  });
}

function indianFriendly({ params }: Ctx): ResultEnvelope {
  const country = str(params.country, "Germany");
  return envelope("indian_friendly", {
    title: `Employers in ${country} that hire Indian-educated people`,
    coverage_note: "Example data. Based on 2,106 Indian-educated people working in this country with visible profiles.",
    sections: [
      { id: "employers", kind: "ranked_table", title: "Employers with Indian-educated hires", data: { n: 2106, columns: [
        { key: "employer", label: "Employer", type: "text" },
        { key: "hires", label: "Hires", type: "int", bar: true },
        { key: "recent", label: "Last 24 months", type: "int" },
        { key: "seniority", label: "Highest level reached", type: "text" },
        { key: "tenure", label: "Median stay", type: "years" },
        { key: "signals", label: "Sponsorship", type: "badges" },
      ], rows: [
        { cells: { employer: "SAP", hires: 164, recent: 41, seniority: "Director", tenure: 3.8, signals: ["Mentions sponsorship"] } },
        { cells: { employer: "Siemens", hires: 121, recent: 27, seniority: "Senior manager", tenure: 4.1, signals: ["Mentions sponsorship"] } },
        { cells: { employer: "Zalando", hires: 88, recent: 30, seniority: "Lead", tenure: 2.6, signals: ["Mentions sponsorship"] } },
        { cells: { employer: "Bosch", hires: 79, recent: 14, seniority: "Senior manager", tenure: 4.4, signals: [] } },
        { cells: { employer: "Delivery Hero", hires: 61, recent: 22, seniority: "Lead", tenure: 2.2, signals: ["Mentions sponsorship"] } },
      ] } },
      { id: "method", kind: "text", title: "How we decide", data: { text: "An employer appears when at least 5 people whose first degree was from an Indian institution have worked there. Sponsorship signals come from their current postings; Germany has no public sponsor register, so no register badge is shown." } },
    ],
    next_steps: [{ label: "See internship chances at these employers", tool: "internship_chances", params: { country } }],
    evidence: [ev("ev_if", "/person/search", 2106, 200, { country, education_country: "India" })],
  });
}

function marketSaturation({ params }: Ctx): ResultEnvelope {
  const role = str(params.role, "Data Engineer");
  const country = str(params.country, "Germany");
  const q = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
  return envelope("market_saturation", {
    title: `How crowded ${role} is in ${country}`,
    coverage_note: "Example data. Entrants are people like you who started this role in the quarter; openings are postings found.",
    sections: [
      { id: "ratio", kind: "stat", title: "Entrants per opening", data: { label: "new entrants like you per open posting", value: 0.6, display: "0.6", level: "low", note: "Fewer newcomers than openings" } },
      { id: "trend", kind: "timeseries", title: "Entrants and openings by quarter", data: { series: [
        { key: "entrants", label: "Entrants like you", points: q.map((period, i) => ({ period, value: [212, 238, 251, 266, 274][i] })) },
        { key: "openings", label: "Openings", points: q.map((period, i) => ({ period, value: [431, 402, 418, 440, 463][i] })) },
      ] } },
      { id: "read", kind: "text", title: "What this means", data: { text: "There are still more openings than newcomers with your background, but the gap has narrowed over the past year. Entry-level postings are the tightest part of the market." } },
      { id: "cities", kind: "ranked_table", title: "Comparable cities", data: { columns: [
        { key: "city", label: "City", type: "text" },
        { key: "ratio", label: "Entrants per opening", type: "text" },
        { key: "openings", label: "Openings", type: "int", bar: true },
      ], rows: [
        { cells: { city: "Berlin", ratio: "0.7", openings: 188 }, you: true },
        { cells: { city: "Munich", ratio: "0.5", openings: 141 } },
        { cells: { city: "Hamburg", ratio: "0.4", openings: 72 } },
        { cells: { city: "Amsterdam", ratio: "0.9", openings: 96 } },
      ] } },
    ],
    next_steps: [{ label: "See the routes into this role", tool: "reverse_gps", params: { goal_text: `${role} in ${country}` } }],
    evidence: [ev("ev_ms", "/job/search", 2154, 2154, { title: role, country })],
  });
}

export function buildResult(tool: ToolId, ctx: Ctx): ResultEnvelope {
  switch (tool) {
    case "people_like_me":
      return peopleLikeMe(ctx);
    case "internship_chances":
      return internshipChances(ctx);
    case "conversion_map":
      return conversionMap(ctx);
    case "reverse_gps":
      return reverseGps(ctx);
    case "routes_to_position":
      return routesToPosition(ctx);
    case "job_postings":
      return jobPostings(ctx);
    case "indian_friendly":
      return indianFriendly(ctx);
    case "market_saturation":
      return marketSaturation(ctx);
  }
}

export const JOB_STEPS: Record<ToolId, string[]> = {
  people_like_me: [
    "Reading your background",
    "Finding people from your college and field",
    "Counting people with your background",
    "Checking where they work now",
    "Grouping by country",
    "Grouping by role and employer",
    "Looking for further degrees",
    "Checking coverage",
    "Writing it up",
  ],
  internship_chances: ["Finding internships like yours", "Following each one forward", "Counting conversions", "Checking coverage", "Writing it up"],
  conversion_map: ["Finding internships in scope", "Matching companies", "Counting conversions", "Ranking", "Writing it up"],
  reverse_gps: ["Reading your goal", "Finding people in that position", "Tracing their routes backward", "Matching routes to your start", "Finding the gaps", "Writing it up"],
  routes_to_position: ["Finding people in the position", "Tracing previous roles", "Grouping feeders", "Writing it up"],
  job_postings: ["Searching postings", "Reading requirements", "Checking languages and visas", "Matching hires to postings", "Writing it up"],
  indian_friendly: ["Finding Indian-educated people abroad", "Grouping by employer", "Checking postings for sponsorship", "Writing it up"],
  market_saturation: ["Counting new entrants", "Counting openings", "Comparing quarters", "Comparing cities", "Writing it up"],
};
