/** Example company profiles (CONTRACT Appendix D) for mock mode. */
import type { CompanyProfile, DrillToken } from "@/lib/drill-types";
import type { Evidence, Section } from "@/lib/types";
import { makeCount } from "@/lib/count";
import { apportion, extend, getParam, MASTERS, ROLE_WEIGHTS, step, type Entry } from "./drill-data";

const DATE = "2026-11-06";

interface Facts {
  domain: string;
  industry: string;
  hq: { city: string; country: string };
  india: CompanyProfile["india_presence"];
  headcount: number;
  growth: number;
  postings: number;
  change: number;
  careers: string;
}

const FACTS: Record<string, Facts> = {
  SAP: {
    domain: "sap.com",
    industry: "Enterprise software",
    hq: { city: "Walldorf", country: "Germany" },
    india: { has_india_office: true, is_gcc: true, india_cities: ["Bengaluru", "Gurugram"] },
    headcount: 107000,
    growth: 0.03,
    postings: 214,
    change: 0.12,
    careers: "https://jobs.sap.com/",
  },
  Zalando: {
    domain: "zalando.com",
    industry: "Online retail",
    hq: { city: "Berlin", country: "Germany" },
    india: { has_india_office: false, is_gcc: false, india_cities: [] },
    headcount: 15200,
    growth: -0.02,
    postings: 96,
    change: -0.08,
    careers: "https://jobs.zalando.com/",
  },
  Siemens: {
    domain: "siemens.com",
    industry: "Industrial technology",
    hq: { city: "Munich", country: "Germany" },
    india: { has_india_office: true, is_gcc: true, india_cities: ["Bengaluru", "Pune", "Chennai"] },
    headcount: 320000,
    growth: 0.01,
    postings: 388,
    change: 0.04,
    careers: "https://jobs.siemens.com/",
  },
};

const ev = (id: string, endpoint: string, total: number, note: string): Evidence => ({
  id,
  endpoint,
  filters: {},
  total_count: total,
  results_used: Math.min(total, 200),
  fetched_at: `${DATE}T09:44:00Z`,
  source: "mock",
  note,
});

export function companyProfile(
  name: string,
  token: DrillToken,
  n: number,
  parentN: number,
  entries: (Entry & { count: number })[],
): { company: CompanyProfile; sections: Section[]; evidence: Evidence[] } {
  const f = FACTS[name];
  const country = entries[0]?.country ?? "Germany";
  const school = String(getParam(token.params, "scope.school") ?? getParam(token.params, "school") ?? "") || null;
  const postings = f?.postings ?? 40;

  // Offices with people like you (from the same joint table the parent page used).
  const offices = new Map<string, number>();
  for (const e of entries) offices.set(e.city, (offices.get(e.city) ?? 0) + e.count);
  const officeList = [...offices.entries()].sort((a, b) => b[1] - a[1]).map(([city, c]) => ({ city, country, people_like_you: c }));

  const byRole = apportion(postings, [["Software Engineer", 41], ["Data Engineer", 18], ["Consultant", 15], ["Data Scientist", 9], ["Working student, data", 7], ["Other roles", 124]] as [string, number][]);
  const byLoc = apportion(postings, [[f?.india?.india_cities?.[0] ?? "Remote", 61], [f?.hq.city ?? "Head office", 52], ["Berlin", 40], ["Munich", 18], ["Other", 43]] as [string, number][]);
  const lang = apportion(postings, [["en", 128], ["de", 72], ["other", 14]] as [string, number][]);
  const spons = Math.round(postings * 0.173);
  const indian = Math.round((f?.headcount ?? 4000) * 0.00385);
  const internsHere = Math.max(n + 2, Math.round(n * 1.17));

  const company: CompanyProfile = {
    name,
    domain: f?.domain ?? null,
    industry: f?.industry ?? null,
    hq: f?.hq ?? null,
    international: f ? true : null,
    india_presence: f?.india ?? null,
    headcount: f ? { total: f.headcount, growth_12m: f.growth, by_function: [{ label: "Engineering", count: Math.round(f.headcount * 0.355), growth_12m: f.growth + 0.02 }] } : null,
    funding: null,
    offices: officeList,
    people_like_you: makeCount(n, parentN, ["ev_co_people"]),
    indian_educated: {
      count: makeCount(indian, indian, ["ev_co_indian"]),
      recent_24m: Math.round(indian * 0.1),
      senior_share: makeCount(Math.round(indian * 0.2), indian),
      median_tenure_years: 2.5,
    },
    hiring: {
      open_postings_90d: postings,
      change_vs_prev: f?.change ?? null,
      by_role: byRole.map(([label, count]) => ({ label, count })),
      by_location: byLoc.map(([label, count]) => ({ label, count })),
      language: { english_only: lang[0][1], german_required: lang[1][1], other: lang[2][1] },
      sponsorship_mentions: makeCount(spons, postings, ["ev_07"]),
      hire_through: { postings_seen: 60, matched_hires: 37, label: "high", note: "Postings 3–12 months old that led to a matching hire." },
      median_days_open: 38,
    },
    internship_conversion: makeCount(Math.max(1, internsHere - 3), internsHere, ["ev_co_interns"]),
    promotion: { median_years_to_first_promotion: 2.0, n },
    retention: { median_tenure_years: 2.8, left_within_1y: makeCount(Math.max(1, Math.round(n * 0.17)), n) },
    visa_signals: [
      { label: "Mentions visa sponsorship in postings", evidence_id: "ev_07" },
      ...(country === "Germany" ? [{ label: "Blue Card salary range typical for these roles", evidence_id: "ev_12" }] : []),
    ],
  };

  const ms = MASTERS[country] ?? [];
  const programs = apportion(n, [...ms.slice(0, 3).map(([s, d], i) => [`${s} · ${d}`, [5, 3, 2][i]] as [string, number]), ["Other programs", 2]]);
  const programRows = [
    ...(school ? [{ id: "own", cells: { program: `${school} · BTech CSE`, people: n }, badges: ["Your college"], you: true, drill: extend(token, step("school", school)) }] : []),
    ...programs.filter(([, c]) => c > 0).map(([p, c]) => ({ id: p, cells: { program: p, people: c }, rest: p === "Other programs" || undefined, ...(p === "Other programs" ? {} : { drill: extend(token, step("degree", p)) }) })),
  ];

  const feeders = apportion(n, [["Infosys", 4], ["TCS", 2], ["Accenture", 2], ["Joined from study", 4]] as [string, number][]).filter(([, c]) => c > 0);
  const degreeCountries = apportion(n, [[country, 3], ["India", 1]] as [string, number][]).filter(([, c]) => c > 0);
  const roles = apportion(n, ROLE_WEIGHTS).filter(([, c]) => c > 0);
  const seniority = apportion(n, [["Entry", 7], ["Mid", 4], ["Senior", 1]] as [string, number][]).filter(([, c]) => c > 0);
  const r1 = Math.round(n * 0.58);
  const r2 = Math.min(n - r1, Math.max(0, Math.round(n * 0.25)));

  const years = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  const split = apportion(n, [[0, 1], [1, 1], [2, 2], [3, 3], [4, 3], [5, 2], [6, 1]] as [number, number][]);
  const ms1 = apportion(r1, split.map(([i, c]) => [i, c] as [number, number]));
  const tr1 = apportion(r2, split.map(([i, c]) => [i, i >= 2 ? c : 0] as [number, number]));
  const series = [
    { key: "ms_ws", label: "MS → working student", points: years.map((p, i) => ({ period: p, value: ms1[i][1] })) },
    { key: "transfer", label: "Transfer from India", points: years.map((p, i) => ({ period: p, value: tr1[i][1] })) },
    { key: "other", label: "Other", points: years.map((p, i) => ({ period: p, value: Math.max(0, split[i][1] - ms1[i][1] - tr1[i][1]) })) },
  ];

  const roleWithTok = (label: string) => extend(token, step("role", label));
  const sections: Section[] = [
    {
      id: "programs",
      kind: "ranked_table",
      title: "Programs they came from",
      data: { n, columns: [{ key: "program", label: "Program", type: "text" }, { key: "people", label: "People", type: "int", bar: true }], rows: programRows },
    } as unknown as Section,
    {
      id: "feeder_employers",
      kind: "ranked_table",
      title: `Worked before ${name}`,
      data: {
        n,
        columns: [{ key: "employer", label: "Employer", type: "text" }, { key: "people", label: "People", type: "int", bar: true }],
        rows: feeders.map(([e, c]) => ({
          id: e,
          cells: { employer: e, people: c },
          ...(e === "Infosys" ? { badges: ["Like you"], you: true } : {}),
          ...(e === "Joined from study" ? { rest: true } : { drill: extend({ ...token, path: token.path.slice(0, -1) }, step("company", e)) }),
        })),
      },
    } as unknown as Section,
    {
      id: "degree_countries",
      kind: "distribution",
      title: "Highest degree earned in",
      data: { n, unit: "people", items: degreeCountries.map(([label, count]) => ({ label, count, drill: extend(token, step("degree_country", label)) })) },
    } as unknown as Section,
    {
      id: "roles",
      kind: "distribution",
      title: `What they do at ${name}`,
      data: { n, unit: "people", items: roles.map(([label, count]) => ({ label, count, drill: roleWithTok(label) })) },
    } as unknown as Section,
    {
      id: "seniority",
      kind: "distribution",
      title: "Seniority",
      data: { n, unit: "people", items: seniority.map(([label, count]) => ({ label, count, drill: extend(token, step("seniority", label)) })) },
    } as unknown as Section,
    { id: "joined_by_year", kind: "timeseries", title: `Joined ${name}, by year`, data: { unit: "people", series } } as unknown as Section,
    {
      id: "entry_routes",
      kind: "route_list",
      title: "Entry routes",
      data: {
        caption: n - r1 - r2 > 0 ? `The other ${n - r1 - r2} joined by mixed routes; none was shared by 3 or more people.` : undefined,
        routes: [
          { id: "r1", steps: [{ label: `MS in ${country}` }, { label: `Working student at ${name}` }, { label: `Full-time at ${name}` }], people: makeCount(r1, n), typical_years: 3, fit: "fits_you", gaps: ["A master's in " + country], drill: extend(token, step("route", "ms_ws", `MS → working student → ${name}`)) },
          ...(r2 > 0 ? [{ id: "r2", steps: [{ label: "Infosys, India" }, { label: `${name} ${f?.india?.india_cities?.[0] ?? "India"}` }, { label: `Transfer to ${country}` }], people: makeCount(r2, n), typical_years: 4, fit: "stretch" as const, gaps: [], drill: extend(token, step("route", "transfer", "Transfer from India")) }] : []),
        ],
      },
    } as unknown as Section,
    {
      id: "open_roles",
      kind: "ranked_table",
      title: "Open now",
      data: {
        n: postings,
        columns: [
          { key: "role", label: "Role", type: "text" },
          { key: "city", label: "City", type: "text" },
          { key: "posted", label: "Posted", type: "text" },
          { key: "language", label: "Language", type: "badges" },
        ],
        rows: [
          { id: "j1", cells: { role: `Data Engineer, ${name === "SAP" ? "Business Data Cloud" : "Platform"}`, city: "Berlin", posted: "4 days ago", language: ["English OK"] }, posting_url: f?.careers ?? null },
          { id: "j2", cells: { role: "Working Student, Data Science", city: f?.hq.city ?? "Berlin", posted: "9 days ago", language: ["German B2"] }, posting_url: f?.careers ?? null },
          { id: "j3", cells: { role: "Software Engineer, Analytics", city: "Munich", posted: "12 days ago", language: ["English OK"] }, posting_url: f?.careers ?? null },
        ],
      },
    } as unknown as Section,
  ];

  const evidence = [
    ev("ev_co_enrich", "/company/enrich", 1, `Company facts for ${name}`),
    ev("ev_co_people", "/person/search", n, `People matching your filters who work at ${name}`),
    ev("ev_co_indian", "/person/search", indian, `Indian-educated people at ${name}, company-wide`),
    ev("ev_co_interns", "/person/search", internsHere, `Interns and working students at ${name} matching your filters`),
    ev("ev_07", "/job/search", postings, "Text match for visa sponsorship in the posting body"),
    ev("ev_12", "/job/search", 23, "Posted salary ranges at or above the Blue Card threshold"),
    ev("ev_co_jobs", "/job/search", postings, `All ${name} postings in the last 90 days`),
  ];
  return { company, sections, evidence };
}
