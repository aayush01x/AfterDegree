import type { Goals, ToolId } from "./types";
import type { ToolField } from "./tools";

/**
 * Merged tool pages: one shared form, one tab per engine tool. Each tab runs its own tool the
 * first time it is opened for a given set of answers, so an unopened tab costs nothing.
 */
export interface MergedTab {
  key: string;
  tool: ToolId;
  label: string;
  /** One line under the tabs saying what this view answers. */
  blurb: string;
  blurbUniversity?: string;
  /** Shared flat form values → this tool's request body. */
  toParams: (v: Record<string, string>) => Record<string, unknown>;
  /** Form fields this tab needs before it can run. */
  requires?: string[];
}

export interface MergedPage {
  slug: string;
  short: string;
  title: string;
  purpose: string;
  purposeUniversity: string;
  runLabel: string;
  fields: ToolField[];
  tabs: MergedTab[];
}

const firstRole = (g: Goals) => g.target_roles[0];
const firstCountry = (g: Goals) => g.target_countries[0];
const firstCity = (g: Goals) => g.target_cities[0];

/** Drop empty strings so the engine sees only what the user gave. */
const compact = (o: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));

export const MERGED: MergedPage[] = [
  {
    slug: "career-routes",
    short: "Career Routes",
    title: "Career routes",
    purpose: "Name a goal. See the routes people took to reach it, and the doors they came in through.",
    purposeUniversity: "Name a position. See the routes your graduates took to reach it, and where its people came from.",
    runLabel: "Trace the routes",
    fields: [
      { name: "role", label: "Role you're aiming for", kind: "text", required: true, placeholder: "e.g. Data Engineer", fromGoals: firstRole },
      { name: "company", label: "Company", kind: "text", placeholder: "Any company", help: "Narrows it to one employer." },
      { name: "city", label: "City", kind: "text", placeholder: "Any city", fromGoals: firstCity },
      { name: "country", label: "Country", kind: "text", placeholder: "e.g. Germany", fromGoals: firstCountry },
    ],
    tabs: [
      {
        key: "path",
        tool: "reverse_gps",
        label: "Your path there",
        blurb: "Step-by-step routes from where you are today, ranked by how well they fit you.",
        blurbUniversity: "Step-by-step routes your graduates took into this position.",
        requires: ["role"],
        toParams: (v) =>
          v.role?.trim()
            ? compact({ role: v.role, company: v.company, city: v.city, country: v.country })
            : compact({ goal_text: v.goal_text }),
      },
      {
        key: "way-in",
        tool: "routes_to_position",
        label: "The way in",
        blurb: "Where people in this position came from: employers, previous titles, schools and years of experience.",
        requires: ["role"],
        toParams: (v) => compact({ role: v.role, company: v.company, city: v.city, country: v.country }),
      },
      {
        key: "colleges",
        tool: "college_paths",
        label: "Colleges & programmes",
        blurb: "Which universities and programmes took people like you to this goal, how often each one did, and how your own college compares.",
        blurbUniversity: "Which of your programmes lead to this position, and how often.",
        requires: ["role"],
        toParams: (v) => compact({ role: v.role, company: v.company, city: v.city, country: v.country }),
      },
    ],
  },
  {
    slug: "internship-to-job",
    short: "Internship → Job",
    title: "Internship to job",
    purpose: "How often internships and working-student roles turned into full-time jobs, for people like you and by company.",
    purposeUniversity: "How often your graduates' internships turned into full-time jobs, and which companies convert.",
    runLabel: "Show the chances",
    fields: [
      { name: "country", label: "Country", kind: "text", placeholder: "Any country", fromGoals: firstCountry },
      { name: "role", label: "Role", kind: "text", placeholder: "Any role", fromGoals: firstRole },
      { name: "company", label: "Company", kind: "text", placeholder: "Any company", help: "Only for your chances." },
      {
        name: "field",
        label: "Field of study",
        kind: "text",
        placeholder: "e.g. Computer Science",
        help: "Only for the company ranking.",
        fromProfile: (d) => (d.undergrad_field ? (/computer science/i.test(d.undergrad_field) ? "Computer Science" : d.undergrad_field) : undefined),
      },
    ],
    tabs: [
      {
        key: "chances",
        tool: "internship_chances",
        label: "Your chances",
        blurb: "People like you: how many interns converted to a full-time job, and where.",
        blurbUniversity: "Your graduates: how many interns converted to a full-time job, and where.",
        toParams: (v) => compact({ role: v.role, company: v.company, country: v.country }),
      },
      {
        key: "companies",
        tool: "conversion_map",
        label: "Companies ranked",
        blurb: "Everyone from your field: companies ranked by how often their interns stayed on, with how many interns each figure rests on.",
        toParams: (v) => ({ scope: compact({ field: v.field, country: v.country, role: v.role, school: v.school }) }),
      },
    ],
  },
];

export function mergedFor(tool: ToolId): { page: MergedPage; tab: MergedTab } | undefined {
  for (const page of MERGED) {
    const tab = page.tabs.find((t) => t.tool === tool);
    if (tab) return { page, tab };
  }
  return undefined;
}

export const mergedBySlug = (slug: string) => MERGED.find((p) => p.slug === slug);

/** Flat query (dotted keys allowed) for a merged page: "scope.field" → "field", plus the tab. */
export function mergedHref(page: MergedPage, tab: MergedTab, flat: Record<string, string>): string {
  const qs = new URLSearchParams();
  qs.set("tab", tab.key);
  for (const [k, v] of Object.entries(flat)) {
    if (!v || k === "tab") continue;
    qs.set(k.replace(/^scope\./, ""), v);
  }
  return `/tools/${page.slug}?${qs.toString()}`;
}

