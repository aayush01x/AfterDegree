import type { Derived, Goals } from "@/lib/types";
import type { ToolField } from "@/lib/tools";
import type { FeatureConfig } from "../types";

/** Parameter form for the Conversion Map (CONTRACT: `scope` with optional school/field/country/role). */
const fields: ToolField[] = [
  {
    name: "scope.field",
    label: "Field of study",
    kind: "text",
    placeholder: "e.g. Computer Science",
    help: "We look at interns and working students from this field.",
    fromProfile: (d) => shortField(d.undergrad_field) || undefined,
  },
  {
    name: "scope.country",
    label: "Country of the company",
    kind: "text",
    placeholder: "Any country",
    help: "Leave blank to see companies everywhere.",
    fromGoals: (g) => g.target_countries[0],
  },
  {
    name: "scope.role",
    label: "Role",
    kind: "text",
    placeholder: "Any role, e.g. Data Engineer",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "scope.school",
    label: "Your college",
    kind: "text",
    placeholder: "Any college",
    help: "Add your college to see only people from it. With few people, the numbers get shaky.",
  },
];

function shortField(f: string | null | undefined): string {
  if (!f) return "";
  return /computer science/i.test(f) ? "Computer Science" : f;
}

export type ConversionValues = Record<string, string>;

/** Values derived from the stored profile and goals. Broad on purpose: college stays blank. */
export function defaultsFrom(goals?: Goals | null, derived?: Derived | null): ConversionValues {
  return {
    "scope.field": shortField(derived?.undergrad_field),
    "scope.country": goals?.target_countries[0] ?? "",
    "scope.role": goals?.target_roles[0] ?? "",
    "scope.school": "",
  };
}

/** Everything is optional; we only guard against absurd input. */
export function validate(values: ConversionValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if ((values[f.name] ?? "").trim().length > 80) errors[f.name] = "Please keep this under 80 characters.";
  }
  return errors;
}

/** Nested request body: { scope: { ... } } with empty values dropped. */
export function toParams(values: ConversionValues): { scope: Record<string, string> } {
  const scope: Record<string, string> = {};
  for (const [path, raw] of Object.entries(values)) {
    const v = raw.trim();
    if (v) scope[path.replace(/^scope\./, "")] = v;
  }
  return { scope };
}

export const config: FeatureConfig & {
  defaultsFrom: typeof defaultsFrom;
  validate: typeof validate;
  toParams: typeof toParams;
  /** Rows with fewer people than this are folded into "Other" by the engine. */
  minRowSize: number;
} = {
  fields,
  defaults: {},
  runLabel: "Show the map",
  autoRun: true,
  defaultsFrom,
  validate,
  toParams,
  minRowSize: 5,
};
