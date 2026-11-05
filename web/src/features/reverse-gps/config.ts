import type { Goals } from "@/lib/types";
import type { ToolField } from "@/lib/tools";
import type { FeatureConfig } from "../types";

/**
 * Parameter form for the Reverse Career GPS.
 * CONTRACT: either { goal_text } or { role, city, country, company? }.
 * The form asks for free text; the View shows the parsed goal as editable chips
 * and re-runs with the structured pieces joined back into one sentence.
 */
const fields: ToolField[] = [
  {
    name: "goal_text",
    label: "Where do you want to get to?",
    kind: "text",
    required: true,
    placeholder: "e.g. ML engineer in Berlin",
    help: "A role and a place is enough. Add a company if you have one in mind.",
    fromGoals: (g) => {
      const role = g.target_roles[0];
      const place = g.target_cities[0] ?? g.target_countries[0];
      return role && place ? `${role} in ${place}` : role;
    },
  },
];

export interface GoalParts {
  role?: string;
  city?: string;
  country?: string;
  company?: string;
}

/** Compose the free-text sentence from structured pieces ("Data Engineer at SAP in Berlin, Germany"). */
export function goalText(p: GoalParts): string {
  const place = [p.city, p.country].filter(Boolean).join(", ");
  return [p.role, p.company ? `at ${p.company}` : "", place ? `in ${place}` : ""].filter(Boolean).join(" ");
}

export type GpsValues = Record<string, string>;

export function defaultsFrom(goals?: Goals | null): GpsValues {
  const parts: GoalParts = {
    role: goals?.target_roles[0],
    city: goals?.target_cities[0],
    country: goals?.target_countries[0],
    company: goals?.target_companies[0],
  };
  const place = parts.city ?? parts.country;
  return { goal_text: parts.role && place ? `${parts.role} in ${place}` : (parts.role ?? "") };
}

/** A goal needs at least a role, written as free text. */
export function validate(values: GpsValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = (values.goal_text ?? "").trim();
  if (!text) errors.goal_text = "Tell us the role you are aiming for, for example \"Data Engineer in Berlin\".";
  else if (text.length > 160) errors.goal_text = "That is a bit long. Try a role and a place.";
  return errors;
}

export function toParams(values: GpsValues): { goal_text: string } {
  return { goal_text: (values.goal_text ?? "").trim() };
}

export const config: FeatureConfig & {
  defaultsFrom: typeof defaultsFrom;
  validate: typeof validate;
  toParams: typeof toParams;
  goalText: typeof goalText;
  /** Number of routes the engine returns (top 3 to 5). */
  maxRoutes: number;
} = {
  fields,
  runLabel: "Trace the routes",
  autoRun: true,
  defaultsFrom,
  validate,
  toParams,
  goalText,
  maxRoutes: 5,
};
