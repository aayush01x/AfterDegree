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
  filters: {
    label: string;
    value: string;
    /** Additive: dotted key of the origin param this filter came from, e.g. "scope.school". */
    param?: string;
    /** Additive: the same drill with this filter dropped (engine-built; preferred over `param`). */
    drill?: DrillToken;
  }[];
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

/* ---------- Additive (web drill pages) ---------- */

/** Anything in a section that can be drilled (distribution item, ranked row, route, node). */
export interface Drillable {
  drill?: DrillToken | null;
}

/** A row of the company `open_roles` table may carry the company's own public posting link. */
export interface PostingRow {
  posting_url?: string | null;
}

/** Optional extras a Drill result may carry; the UI renders them when present. */
/** Optional peek into a breakdown row, shown when its tile is focused (e.g. a city's top companies and roles). */
export interface RowPreview {
  preview?: { label: string; items: { label: string; count: number }[] }[];
}

export interface DrillResultExtras {
  /** What `count.n` counts, e.g. "SAP interns like you" (the page reads "of the 61 SAP interns like you"). */
  count_label?: string;
  /** Mentor-voice sentence written from the facts (LLM; null when unavailable). */
  summary?: string | null;
  coverage?: number | null;
  data_date?: string;
  coverage_note?: string;
  next_steps?: { label: string; tool: string; params: Record<string, unknown> }[];
}

/** PersonDetail extras: how the user's own path compares (computed by the engine when present). */
export interface PersonDetailExtras {
  /** Which person in the originating drill this is (1-based) and how many there are. */
  position?: { index: number; total: number } | null;
  /** Labelled facts explaining why this path is shown, e.g. College: VIT Vellore (same). */
  why?: { label: string; value: string; note?: string }[];
  /** People in the same slice who took the same route, as anonymous cards. */
  same_route?: PersonCard[];
  /** Skills common on this route, with how many of the route's people list each. */
  route_skills?: { term: string; count: number; n: number }[];
  /** Typical years from the route's first step abroad to a full-time job. */
  route_typical_years?: number | null;
  data_date?: string;
}

export type DrillResultFull = DrillResult & DrillResultExtras;
export type PersonDetailFull = PersonDetail & PersonDetailExtras;
