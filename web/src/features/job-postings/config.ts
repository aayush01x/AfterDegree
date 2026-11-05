import type { ToolField } from "@/lib/tools";
import type { FeatureConfig } from "../types";

/** Parameter form for POST /api/tools/job-postings (docs/CONTRACT.md). */

export type FormValues = Record<string, string>;
export type FormErrors = Partial<Record<string, string>>;

const MAX = 80;

const fields: ToolField[] = [
  {
    name: "role",
    label: "Which role are you looking at?",
    kind: "text",
    required: true,
    placeholder: "e.g. Data Engineer",
    help: "We read postings from the last 90 days.",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "city",
    label: "In which city? (optional)",
    kind: "text",
    placeholder: "Any city",
    fromGoals: (g) => g.target_cities[0],
  },
  {
    name: "country",
    label: "In which country?",
    kind: "text",
    required: true,
    placeholder: "e.g. Germany",
    fromGoals: (g) => g.target_countries[0],
  },
];

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const role = (values.role ?? "").trim();
  const country = (values.country ?? "").trim();
  if (!role) errors.role = "Tell us the role, for example Data Engineer.";
  else if (role.length < 2) errors.role = "That role looks very short. Try the full job title.";
  if (!country) errors.country = "Add the country you would like to work in.";
  for (const f of fields) {
    if ((values[f.name] ?? "").length > MAX) errors[f.name] = `Please keep this under ${MAX} characters.`;
  }
  return errors;
}

function toBody(values: FormValues): Record<string, string> {
  const body: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.name] ?? "").trim();
    if (v) body[f.name] = v;
  }
  return body;
}

export const config: FeatureConfig = {
  fields,
  defaults: {},
  runLabel: "Read the postings",
  autoRun: true,
};

/** Exposed for the shell and tests: friendly validation and the contract request body. */
export { validate, toBody };
