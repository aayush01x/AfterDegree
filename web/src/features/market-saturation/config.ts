import type { Derived, Goals } from "@/lib/types";
import type { ToolField } from "@/lib/tools";

/** Parameter form for Market Saturation (CONTRACT: role and country required, city optional). */
export const fields: ToolField[] = [
  {
    name: "role",
    label: "Which role are you aiming for?",
    kind: "text",
    required: true,
    placeholder: "e.g. Data Engineer",
    help: "We count newcomers with your kind of background who started in this role.",
    fromGoals: (g) => g.target_roles[0],
  },
  {
    name: "country",
    label: "Which country?",
    kind: "text",
    required: true,
    placeholder: "e.g. Germany",
    fromGoals: (g) => g.target_countries[0],
  },
  {
    name: "city",
    label: "Which city?",
    kind: "text",
    placeholder: "Any city, e.g. Berlin",
    help: "Optional. A single city gives a sharper picture, and we compare it with nearby cities.",
    fromGoals: (g) => g.target_cities[0],
  },
];

export type MarketSaturationValues = { role: string; country: string; city: string };

export interface MarketSaturationParams {
  role: string;
  country: string;
  city?: string;
}

/** Defaults come from the stored goals. */
export function defaultsFrom(goals?: Goals | null, _derived?: Derived | null): MarketSaturationValues {
  return {
    role: goals?.target_roles[0] ?? "",
    country: goals?.target_countries[0] ?? "",
    city: goals?.target_cities[0] ?? "",
  };
}

export function validate(values: Partial<MarketSaturationValues>): Partial<Record<keyof MarketSaturationValues, string>> {
  const errors: Partial<Record<keyof MarketSaturationValues, string>> = {};
  const role = (values.role ?? "").trim();
  const country = (values.country ?? "").trim();
  if (!role) errors.role = "Tell us the role, so we know whose openings to count.";
  else if (role.length > 80) errors.role = "Please keep this under 80 characters.";
  if (!country) errors.country = "Tell us which country, so we know where to look.";
  else if (country.length > 60) errors.country = "Please keep this under 60 characters.";
  if ((values.city ?? "").trim().length > 60) errors.city = "Please keep this under 60 characters.";
  return errors;
}

export function toParams(values: MarketSaturationValues): MarketSaturationParams {
  const out: MarketSaturationParams = { role: values.role.trim(), country: values.country.trim() };
  if (values.city.trim()) out.city = values.city.trim();
  return out;
}

export type CompetitionLevel = "low" | "medium" | "high";

/** Entrants per opening below LOW_BELOW is "low", above HIGH_ABOVE is "high". Mirrors the engine's labels. */
export const LOW_BELOW = 0.8;
export const HIGH_ABOVE = 1.5;

export function levelFor(ratio: number): CompetitionLevel {
  if (ratio < LOW_BELOW) return "low";
  if (ratio > HIGH_ABOVE) return "high";
  return "medium";
}

export const config = {
  id: "market_saturation" as const,
  slug: "market-saturation",
  title: "Market saturation",
  purpose: "New entrants with your kind of background against open postings, and which way it is moving.",
  purposeUniversity: "New entrants like your graduates against open postings, and which way it is moving.",
  endpoint: "/tools/market-saturation",
  runLabel: "Show me how crowded it is",
  fields,
  defaults: {} as Record<string, string>,
  defaultsFrom,
  validate,
  toParams,
  /** Entrants are counted over the last 12 months; openings over the last 90 days, times four. */
  entrantsWindowMonths: 12,
  openingsWindowDays: 90,
};

export type MarketSaturationConfig = typeof config;
