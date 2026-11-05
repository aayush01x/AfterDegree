import type { ToolField } from "@/lib/tools";
import type { Goals } from "@/lib/types";
import type { FeatureConfig } from "../types";

/** Parameter form for Internship Chances (CONTRACT: optional company, role, country). */
export const fields: ToolField[] = [
  {
    name: "company",
    label: "A company you have in mind",
    kind: "text",
    placeholder: "Any company",
    help: "Leave empty to see all companies. Name one to highlight it in the ranking.",
    fromGoals: (g) => g.target_companies[0],
  },
  {
    name: "role",
    label: "The kind of role",
    kind: "text",
    placeholder: "e.g. Data Engineer",
    help: "Internship or working-student roles in this field.",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "country",
    label: "Where",
    kind: "text",
    required: true,
    placeholder: "e.g. Germany",
    help: "The country where the internship would be.",
    fromGoals: (g) => g.target_countries[0],
  },
];

/** Defaults from the stored goals: the first target of each kind. */
export function defaultsFrom(goals?: Goals | null): Record<string, string> {
  return {
    company: goals?.target_companies[0] ?? "",
    role: goals?.target_roles[0] ?? "",
    country: goals?.target_countries[0] ?? "",
  };
}

export interface InternshipChancesParams {
  company?: string;
  role?: string;
  country?: string;
}

export function validate(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const country = (values.country ?? "").trim();
  if (!country) errors.country = "Tell us which country, for example Germany.";
  else if (country.length > 60) errors.country = "That country name is too long. Try just the country.";
  for (const key of ["company", "role"]) {
    if ((values[key] ?? "").trim().length > 80) errors[key] = "That is a bit long. Try a shorter name.";
  }
  return errors;
}

export function toParams(values: Record<string, string>): InternshipChancesParams {
  const out: InternshipChancesParams = {};
  for (const k of ["company", "role", "country"] as const) {
    const v = (values[k] ?? "").trim();
    if (v) out[k] = v;
  }
  return out;
}

export const config: FeatureConfig = {
  fields,
  runLabel: "Work out my chances",
  autoRun: true,
};
