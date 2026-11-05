import type { ToolField } from "@/lib/tools";
import type { Derived, MatchLevel } from "@/lib/types";
import type { FeatureConfig } from "../types";

/**
 * Parameter form for People Like Me (CONTRACT: `match` and `exp_band: [min, max]`).
 * The experience band is a select whose value is "min,max" so a next-step link
 * (`exp_band: [1, 3]` flattened by toHref) lands on the same option.
 */
export const BANDS = [
  { value: "0,1", label: "Under 1 year of work" },
  { value: "1,3", label: "1 to 3 years of work" },
  { value: "3,5", label: "3 to 5 years of work" },
  { value: "5,8", label: "5 to 8 years of work" },
];

export const MATCH_LEVELS: { value: MatchLevel; label: string }[] = [
  { value: "exact_school", label: "Same college and field" },
  { value: "school_tier", label: "Similar colleges, same field" },
  { value: "field_only", label: "Same field, any college" },
];

export const fields: ToolField[] = [
  {
    name: "match",
    label: "Who counts as like you",
    kind: "select",
    help: "Your own college is the closest match. If too few people match, we widen it for you and say so.",
    options: MATCH_LEVELS,
  },
  {
    name: "exp_band",
    label: "Years of work experience",
    kind: "select",
    help: "People with about as much work behind them as you.",
    options: BANDS,
  },
];

/** Preset band containing the user's years of experience, as "min,max". */
export function bandFor(years: number | null | undefined): string {
  if (years === null || years === undefined) return "1,3";
  if (years < 1) return "0,1";
  if (years < 3) return "1,3";
  if (years < 5) return "3,5";
  return "5,8";
}

/** Form defaults from the stored profile (goals do not change this tool's form). */
export function defaultsFrom(derived?: Derived | null): Record<string, string> {
  return { match: "exact_school", exp_band: bandFor(derived?.years_experience) };
}

export interface PeopleLikeMeParams {
  match: MatchLevel;
  exp_band: [number, number];
}

export function validate(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.match && !MATCH_LEVELS.some((m) => m.value === values.match)) {
    errors.match = "Pick how closely people should match you.";
  }
  if (values.exp_band && !BANDS.some((b) => b.value === values.exp_band)) {
    errors.exp_band = "Pick a range of work experience.";
  }
  return errors;
}

/** Contract body: exp_band as [min, max]. Use this to convert the form's "min,max" value. */
export function toParams(values: Record<string, string>): PeopleLikeMeParams {
  const [lo, hi] = (values.exp_band || "1,3").split(",").map(Number);
  return { match: (values.match as MatchLevel) || "exact_school", exp_band: [lo, hi] };
}

export const config: FeatureConfig = {
  fields,
  defaults: { match: "exact_school", exp_band: "1,3" },
  runLabel: "Show me where they are now",
  autoRun: true,
};
