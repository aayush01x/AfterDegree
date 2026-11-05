import type { Goals, ToolId } from "./types";

export interface ToolField {
  /** Dotted body path, e.g. "role" or "scope.school". */
  name: string;
  label: string;
  kind: "text" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  /** Prefill from the stored goals. */
  fromGoals?: (g: Goals) => string | undefined;
}

export interface ToolDef {
  id: ToolId;
  slug: string;
  /** Short label for the rail. */
  short: string;
  /** Full screen title. */
  title: string;
  /** One-line purpose shown under the title. */
  purpose: string;
  /** University lens purpose ("your graduates"). */
  purposeUniversity: string;
  endpoint: string;
  fields: ToolField[];
}

const firstRole = (g: Goals) => g.target_roles[0];
const firstCountry = (g: Goals) => g.target_countries[0];
const firstCity = (g: Goals) => g.target_cities[0];
const firstCompany = (g: Goals) => g.target_companies[0];

export const TOOLS: ToolDef[] = [
  {
    id: "people_like_me",
    slug: "people-like-me",
    short: "People Like Me",
    title: "People like me",
    purpose: "Where people with your background are now: countries, roles, employers and further degrees.",
    purposeUniversity: "Where your graduates are now: countries, roles, employers and further degrees.",
    endpoint: "/tools/people-like-me",
    fields: [
      {
        name: "match",
        label: "Who counts as like you",
        kind: "select",
        options: [
          { value: "exact_school", label: "Same college and field" },
          { value: "school_tier", label: "Similar colleges, same field" },
          { value: "field_only", label: "Same field, any college" },
        ],
      },
    ],
  },
  {
    id: "internship_chances",
    slug: "internship-chances",
    short: "Internship Chances",
    title: "Internship-to-job chances",
    purpose: "How often internships and working-student roles turned into full-time jobs for people like you.",
    purposeUniversity: "How often your graduates' internships turned into full-time jobs.",
    endpoint: "/tools/internship-chances",
    fields: [
      { name: "company", label: "Company", kind: "text", placeholder: "Any company", fromGoals: firstCompany },
      { name: "role", label: "Role", kind: "text", placeholder: "e.g. Data Engineer", fromGoals: firstRole },
      { name: "country", label: "Country", kind: "text", placeholder: "e.g. Germany", fromGoals: firstCountry },
    ],
  },
  {
    id: "conversion_map",
    slug: "conversion-map",
    short: "Conversion Map",
    title: "Conversion map",
    purpose: "Intern-to-job conversion by company, ranked, with how many interns each figure rests on.",
    purposeUniversity: "Intern-to-job conversion by company for your graduates, ranked, with counts.",
    endpoint: "/tools/conversion-map",
    fields: [
      { name: "scope.field", label: "Field", kind: "text", placeholder: "e.g. Computer Science" },
      { name: "scope.country", label: "Country", kind: "text", placeholder: "e.g. Germany", fromGoals: firstCountry },
      { name: "scope.role", label: "Role", kind: "text", placeholder: "Any role", fromGoals: firstRole },
      { name: "scope.school", label: "School", kind: "text", placeholder: "Any school" },
    ],
  },
  {
    id: "reverse_gps",
    slug: "reverse-gps",
    short: "Reverse Career GPS",
    title: "Reverse career GPS",
    purpose: "Name a goal and see the routes people took to reach it, starting from where you are.",
    purposeUniversity: "Name a position and see the routes that led your graduates there.",
    endpoint: "/tools/reverse-gps",
    fields: [
      {
        name: "goal_text",
        label: "Your goal",
        kind: "text",
        required: true,
        placeholder: "e.g. Data Engineer in Berlin",
        help: "A role and a place is enough. Add a company if you have one in mind.",
        fromGoals: (g) => {
          const role = g.target_roles[0];
          const place = g.target_cities[0] ?? g.target_countries[0];
          return role && place ? `${role} in ${place}` : role;
        },
      },
    ],
  },
  {
    id: "routes_to_position",
    slug: "routes-to-position",
    short: "Routes to Positions",
    title: "Routes to a position",
    purpose: "For one position, the employers, titles, schools and years of experience people came in from.",
    purposeUniversity: "For one position, where the people in it came from, and how many came from programs like yours.",
    endpoint: "/tools/routes-to-position",
    fields: [
      { name: "role", label: "Role", kind: "text", required: true, placeholder: "e.g. Data Engineer", fromGoals: firstRole },
      { name: "company", label: "Company", kind: "text", placeholder: "Any company", fromGoals: firstCompany },
      { name: "city", label: "City", kind: "text", placeholder: "Any city", fromGoals: firstCity },
      { name: "country", label: "Country", kind: "text", placeholder: "e.g. Germany", fromGoals: firstCountry },
    ],
  },
  {
    id: "job_postings",
    slug: "job-postings",
    short: "Job Postings",
    title: "Job posting analysis",
    purpose: "What current postings ask for: volume, seniority, skills, languages, visa mentions and hire-through.",
    purposeUniversity: "What current postings in your graduates' target markets ask for.",
    endpoint: "/tools/job-postings",
    fields: [
      { name: "role", label: "Role", kind: "text", required: true, placeholder: "e.g. Data Engineer", fromGoals: firstRole },
      { name: "city", label: "City", kind: "text", placeholder: "Any city", fromGoals: firstCity },
      { name: "country", label: "Country", kind: "text", required: true, placeholder: "e.g. Germany", fromGoals: firstCountry },
    ],
  },
  {
    id: "indian_friendly",
    slug: "indian-friendly",
    short: "Indian-Friendly",
    title: "Indian-friendly employers",
    purpose: "Employers abroad with a track record of hiring Indian-educated people, and signs they sponsor visas.",
    purposeUniversity: "Employers abroad that have hired Indian-educated graduates, and signs they sponsor visas.",
    endpoint: "/tools/indian-friendly",
    fields: [
      { name: "country", label: "Country", kind: "text", required: true, placeholder: "e.g. Germany", fromGoals: firstCountry },
      { name: "role", label: "Role", kind: "text", placeholder: "Any role", fromGoals: firstRole },
      { name: "city", label: "City", kind: "text", placeholder: "Any city", fromGoals: firstCity },
    ],
  },
  {
    id: "market_saturation",
    slug: "market-saturation",
    short: "Market Saturation",
    title: "Market saturation",
    purpose: "New entrants with your kind of background against open postings, and which way it is moving.",
    purposeUniversity: "New entrants like your graduates against open postings, and which way it is moving.",
    endpoint: "/tools/market-saturation",
    fields: [
      { name: "role", label: "Role", kind: "text", required: true, placeholder: "e.g. Data Engineer", fromGoals: firstRole },
      { name: "city", label: "City", kind: "text", placeholder: "Any city", fromGoals: firstCity },
      { name: "country", label: "Country", kind: "text", required: true, placeholder: "e.g. Germany", fromGoals: firstCountry },
    ],
  },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);

/** Build a /tools URL that pre-fills a tool's form from next-step params. */
export function toolHref(id: ToolId, params: Record<string, unknown> = {}): string {
  const t = toolById(id);
  const qs = new URLSearchParams();
  const flat = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "object" && !Array.isArray(v)) flat(v as Record<string, unknown>, `${prefix}${k}.`);
      else qs.set(`${prefix}${k}`, String(v));
    }
  };
  flat(params);
  const s = qs.toString();
  return `/tools/${t.slug}${s ? `?${s}` : ""}`;
}

/** Turn flat dotted form values into a nested request body. */
export function nestBody(values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, raw] of Object.entries(values)) {
    const v = raw.trim();
    if (!v) continue;
    const parts = path.split(".");
    let cur = out;
    parts.slice(0, -1).forEach((p) => {
      cur[p] = (cur[p] as Record<string, unknown>) ?? {};
      cur = cur[p] as Record<string, unknown>;
    });
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}
