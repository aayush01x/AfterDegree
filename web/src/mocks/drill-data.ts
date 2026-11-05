/**
 * Example data for drill-downs (mock mode). Every level is cut from one joint table per country
 * (city x company), so a tile's count is exactly the count on the page it opens.
 */
import type { DrillStep, DrillToken } from "@/lib/drill-types";

export interface Entry {
  country: string;
  city: string;
  company: string;
  w: number;
}

/** Destination countries per origin tool, as counts of the unfiltered origin cohort. */
export const COUNTRY_WEIGHTS: Record<string, [string, number][]> = {
  people_like_me: [
    ["Germany", 71],
    ["United States", 58],
    ["United Kingdom", 34],
    ["Canada", 27],
    ["Netherlands", 15],
    ["Other countries", 9],
    ["Still in India", 98],
  ],
  conversion_map: [
    ["Germany", 26],
    ["India", 18],
    ["Netherlands", 7],
    ["Ireland", 5],
    ["Other countries", 5],
  ],
  default: [
    ["Germany", 40],
    ["United States", 30],
    ["United Kingdom", 20],
    ["Netherlands", 10],
    ["Other countries", 20],
  ],
};

/** Origin cohort size with every origin filter applied. */
export const ORIGIN_N: Record<string, number> = { people_like_me: 312, conversion_map: 61, default: 120 };

/** How much each origin filter narrows the cohort (dropping it multiplies n by this). */
export const FILTER_WIDEN: Record<string, number> = {
  "scope.company": 2.4,
  company: 2.4,
  "scope.school": 3,
  school: 3,
  exp_band: 1.6,
  "scope.role": 1.8,
  role: 1.8,
  match: 2.2,
};

/** city x company, as weights inside each country. */
const JOINT: Record<string, [string, string, number][]> = {
  Germany: [
    ["Berlin", "SAP", 4],
    ["Berlin", "Zalando", 5],
    ["Walldorf", "SAP", 6],
    ["Munich", "Siemens", 3],
    ["Berlin", "Delivery Hero", 1],
    ["Munich", "SAP", 2],
    ["Frankfurt", "Deutsche Bank", 2],
    ["Frankfurt", "N26", 1],
    ["Hamburg", "Otto", 2],
  ],
  "United States": [
    ["Seattle", "Amazon", 5],
    ["Seattle", "Microsoft", 4],
    ["San Francisco", "Salesforce", 3],
    ["New York", "JPMorgan Chase", 3],
    ["Austin", "Oracle", 2],
    ["Boston", "Wayfair", 2],
  ],
  "United Kingdom": [
    ["London", "Revolut", 3],
    ["London", "Amazon", 3],
    ["London", "Deloitte", 2],
    ["Manchester", "Booking.com", 1],
    ["Edinburgh", "Skyscanner", 2],
  ],
  Canada: [
    ["Toronto", "RBC", 3],
    ["Toronto", "Shopify", 3],
    ["Vancouver", "Amazon", 2],
    ["Montreal", "Ubisoft", 2],
  ],
  Netherlands: [
    ["Amsterdam", "Booking.com", 4],
    ["Amsterdam", "Adyen", 2],
    ["Eindhoven", "ASML", 3],
    ["Rotterdam", "Coolblue", 2],
  ],
  India: [
    ["Bengaluru", "SAP Labs", 6],
    ["Bengaluru", "Infosys", 3],
    ["Gurugram", "SAP Labs", 3],
    ["Pune", "Infosys", 2],
    ["Hyderabad", "Microsoft", 4],
  ],
  Ireland: [
    ["Dublin", "Google", 3],
    ["Dublin", "SAP", 2],
  ],
};

export const ROLE_WEIGHTS: [string, number][] = [
  ["Data Engineer", 4],
  ["Software Engineer", 3],
  ["Data Analyst", 2],
  ["Data Scientist", 2],
];

export const MASTERS: Record<string, [string, string, string][]> = {
  Germany: [
    ["TU Munich", "MSc Informatics", "Munich"],
    ["RWTH Aachen", "MSc Data Science", "Aachen"],
    ["TU Berlin", "MSc Computer Science", "Berlin"],
    ["University of Mannheim", "MSc Data Science", "Mannheim"],
  ],
  "United States": [
    ["Northeastern University", "MS Computer Science", "Boston"],
    ["Arizona State University", "MS Computer Science", "Tempe"],
    ["University of Southern California", "MS Data Science", "Los Angeles"],
  ],
  "United Kingdom": [
    ["Imperial College London", "MSc Computing", "London"],
    ["University of Edinburgh", "MSc Data Science", "Edinburgh"],
  ],
  Canada: [
    ["University of Toronto", "MEng Computer Engineering", "Toronto"],
    ["University of British Columbia", "Master of Data Science", "Vancouver"],
  ],
  Netherlands: [
    ["TU Delft", "MSc Computer Science", "Delft"],
    ["University of Amsterdam", "MSc Data Science", "Amsterdam"],
  ],
  Ireland: [["Trinity College Dublin", "MSc Computer Science", "Dublin"]],
};

export const INDIA_EMPLOYERS: [string, string, string][] = [
  ["Infosys", "Systems Engineer", "Pune"],
  ["TCS", "Assistant Systems Engineer", "Chennai"],
  ["Accenture", "Associate Software Engineer", "Bengaluru"],
  ["Wipro", "Project Engineer", "Hyderabad"],
];

export const SKILLS_BY_ROLE: Record<string, string[]> = {
  "Data Engineer": ["Python", "SQL", "Spark", "Airflow", "AWS", "German B1", "dbt", "Kafka"],
  "Software Engineer": ["Java", "Python", "Kubernetes", "SQL", "AWS", "German A2", "Go", "React"],
  "Data Analyst": ["SQL", "Python", "Power BI", "Excel", "Tableau", "German B1", "dbt", "Statistics"],
  "Data Scientist": ["Python", "SQL", "PyTorch", "Spark", "Statistics", "German A2", "MLflow", "AWS"],
};

/* ---------- helpers ---------- */

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Largest-remainder apportionment of n over weights; keeps the order. */
export function apportion<T>(n: number, items: [T, number][]): [T, number][] {
  const total = items.reduce((s, [, w]) => s + w, 0) || 1;
  const raw = items.map(([k, w]) => [k, (n * w) / total] as const);
  const out = raw.map(([k, x]) => [k, Math.floor(x)] as [T, number]);
  let left = n - out.reduce((s, [, c]) => s + c, 0);
  const order = raw.map(([, x], i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i][1] += 1;
    left -= 1;
  }
  return out;
}

export function entriesFor(country: string): Entry[] {
  const j = JOINT[country];
  if (j) return j.map(([city, company, w]) => ({ country, city, company, w }));
  return [{ country, city: "Elsewhere", company: "Elsewhere", w: 1 }];
}

export const KNOWN_COUNTRIES = Object.keys(JOINT);

/** All entries that contain a company (for a company path without a country). */
export function entriesForCompany(company: string): Entry[] {
  return KNOWN_COUNTRIES.flatMap(entriesFor).filter((e) => e.company === company);
}

export function getParam(params: Record<string, unknown>, dotted: string): unknown {
  let cur: unknown = params;
  for (const k of dotted.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export const step = (dimension: DrillStep["dimension"], value: string, label = value): DrillStep => ({ dimension, value, label });

export const extend = (token: DrillToken, s: DrillStep): DrillToken => ({ ...token, path: [...token.path, s] });

export function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}
