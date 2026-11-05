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

export interface DrillContext {
  origin_tool: string;
  origin_label: string;
  filters: { label: string; value: string }[];
}

export interface CompanyProfile {
  name: string;
  domain?: string | null;
  industry?: string | null;
  hq?: { city?: string; country?: string } | null;
  international?: boolean | null;
  india_presence?: { has_india_office?: boolean; is_gcc?: boolean; india_cities?: string[] } | null;
  headcount?: { total?: number | null; growth_12m?: number | null; by_function?: { label: string; count: number; growth_12m?: number | null }[] } | null;
  funding?: { stage?: string; total_usd?: number | null; last_round_date?: string | null } | null;
  offices?: { city: string; country: string; people_like_you?: number }[];
  people_like_you?: Count;
  indian_educated?: { count?: Count; recent_24m?: number; senior_share?: Count; median_tenure_years?: number | null } | null;
  hiring?: {
    open_postings_90d?: number; change_vs_prev?: number | null;
    by_role?: { label: string; count: number }[]; by_location?: { label: string; count: number }[];
    language?: { english_only?: number; german_required?: number; other?: number } | null;
    sponsorship_mentions?: Count | null;
    hire_through?: { postings_seen: number; matched_hires: number; label: "high" | "some" | "unclear"; note?: string } | null;
    median_days_open?: number | null;
  } | null;
  internship_conversion?: Count | null;
  promotion?: { median_years_to_first_promotion?: number | null; n?: number } | null;
  retention?: { median_tenure_years?: number | null; left_within_1y?: Count | null } | null;
  visa_signals?: { label: string; evidence_id?: string }[];
}

export interface DrillResult {
  /** Present when the last path step is a company (CONTRACT Appendix D). */
  company?: CompanyProfile;
  tool: "drill";
  title: string;
  path: DrillStep[];
  /** The origin screen's filters this drill inherits (shown as removable chips). */
  context?: DrillContext;
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
