// Drill-down contract types (docs/CONTRACT.md, Appendix C).
import type { Count, Section, Evidence, Cohort } from "./types";

export type DrillDimension =
  | "country" | "city" | "company" | "role" | "school" | "degree" | "degree_country"
  | "seniority" | "years_band" | "route" | "route_step" | "posting_employer"
  | "skill" | "language" | "quarter";

export interface DrillStep { dimension: DrillDimension; value: string; label: string }

export interface DrillToken {
  tool: string;
  params: Record<string, unknown>;
  path: DrillStep[];
}

export interface PersonStep {
  kind: "education" | "work" | "internship";
  org: string;
  title?: string;
  city?: string;
  country?: string;
  start_year: number | null;
  end_year: number | null;
  years?: number | null;
}

export interface PersonCard {
  id: string;
  headline: string;
  current?: { title?: string; company?: string; city?: string; country?: string; since_year?: number | null };
  match_reasons?: string[];
  tags?: string[];
  steps: PersonStep[];
}

export interface PersonDetail extends PersonCard {
  skills?: string[];
  route_stats?: { label: string; count: Count }[];
}

export interface DrillResult {
  tool: "drill";
  title: string;
  path: DrillStep[];
  count?: Count;
  cohort?: Cohort | null;
  confidence?: "high" | "medium" | "low";
  sections: Section[];
  people: PersonCard[];
  people_total?: number;
  people_note?: string;
  listing_blocked_reason?: string | null;
  warnings?: string[];
  evidence?: Evidence[];
}
