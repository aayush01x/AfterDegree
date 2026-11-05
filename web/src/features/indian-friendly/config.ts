import type { Derived, Goals } from "@/lib/types";
import type { ToolField } from "@/lib/tools";

/** Parameter form for Indian-Friendly Companies (CONTRACT: country required, role and city optional). */
export const fields: ToolField[] = [
  {
    name: "country",
    label: "Which country do you want to work in?",
    kind: "text",
    required: true,
    placeholder: "e.g. Germany",
    help: "We look at employers in this country that have hired people who studied in India.",
    fromGoals: (g) => g.target_countries[0],
  },
  {
    name: "role",
    label: "Which kind of role?",
    kind: "text",
    placeholder: "Any role, e.g. Data Engineer",
    help: "Optional. Narrowing it shows employers that hired Indian-educated people into this kind of work.",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "city",
    label: "Which city?",
    kind: "text",
    placeholder: "Any city, e.g. Berlin",
    help: "Optional. Leave blank to see the whole country.",
    fromGoals: (g) => g.target_cities[0],
  },
];

export type IndianFriendlyValues = { country: string; role: string; city: string };

export interface IndianFriendlyParams {
  country: string;
  role?: string;
  city?: string;
}

/** Defaults come from the stored goals; the profile does not change this form. */
export function defaultsFrom(goals?: Goals | null, _derived?: Derived | null): IndianFriendlyValues {
  return {
    country: goals?.target_countries[0] ?? "",
    role: goals?.target_roles[0] ?? "",
    city: goals?.target_cities[0] ?? "",
  };
}

export function validate(values: Partial<IndianFriendlyValues>): Partial<Record<keyof IndianFriendlyValues, string>> {
  const errors: Partial<Record<keyof IndianFriendlyValues, string>> = {};
  const country = (values.country ?? "").trim();
  if (!country) errors.country = "Tell us which country, so we know where to look.";
  else if (country.length > 60) errors.country = "Please keep this under 60 characters.";
  if ((values.role ?? "").trim().length > 80) errors.role = "Please keep this under 80 characters.";
  if ((values.city ?? "").trim().length > 60) errors.city = "Please keep this under 60 characters.";
  return errors;
}

export function toParams(values: IndianFriendlyValues): IndianFriendlyParams {
  const out: IndianFriendlyParams = { country: values.country.trim() };
  if (values.role.trim()) out.role = values.role.trim();
  if (values.city.trim()) out.city = values.city.trim();
  return out;
}

export const config = {
  id: "indian_friendly" as const,
  slug: "indian-friendly",
  title: "Indian-friendly employers",
  purpose: "Employers abroad with a track record of hiring Indian-educated people, and signs they sponsor visas.",
  purposeUniversity: "Employers abroad that have hired Indian-educated graduates, and signs they sponsor visas.",
  endpoint: "/tools/indian-friendly",
  runLabel: "Show me employers",
  fields,
  defaults: {} as Record<string, string>,
  defaultsFrom,
  validate,
  toParams,
  /** Employers with fewer people than this are folded into "Other" by the engine (and again in the view). */
  minRowSize: 5,
  /** A person counts as a recent hire when they started within this many months. */
  recentMonths: 24,
};

export type IndianFriendlyConfig = typeof config;
