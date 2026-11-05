import type { ToolField } from "@/lib/tools";
import type { FeatureConfig } from "../types";

/** Parameter form for POST /api/tools/routes-to-position (docs/CONTRACT.md). */

export type FormValues = Record<string, string>;
export type FormErrors = Partial<Record<string, string>>;

const MAX = 80;

const fields: ToolField[] = [
  {
    name: "role",
    label: "Which role do you want to reach?",
    kind: "text",
    required: true,
    placeholder: "e.g. Data Engineer",
    help: "Use the job title people would put on their profile.",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "company",
    label: "At a particular company? (optional)",
    kind: "text",
    placeholder: "Any company",
    help: "Leave this empty to see the whole market. A single company often has too few people to show.",
    fromGoals: (g) => g.target_companies[0],
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
    placeholder: "e.g. Germany",
    fromGoals: (g) => g.target_countries[0],
  },
];

/** Friendly, specific messages. An empty object means the form is valid. */
function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const role = (values.role ?? "").trim();
  if (!role) errors.role = "Tell us the role you are aiming for, for example Data Engineer.";
  else if (role.length < 2) errors.role = "That role looks very short. Try the full job title.";
  for (const f of fields) {
    if ((values[f.name] ?? "").length > MAX) errors[f.name] = `Please keep this under ${MAX} characters.`;
  }
  const hasPlace = ["city", "country"].some((k) => (values[k] ?? "").trim());
  if (!hasPlace) errors.country = "Add a country or a city, so we know where to look.";
  return errors;
}

/** Request body per the contract: optional fields are left out when empty. */
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
  runLabel: "Show the routes",
  autoRun: true,
};

/** Exposed for the shell and tests: friendly validation and the contract request body. */
export { validate, toBody };
