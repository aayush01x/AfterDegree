/**
 * Types mirroring docs/CONTRACT.md (v0.1).
 * Section `data` payloads are typed per kind below; renderers are tolerant
 * of missing optional fields so a partially filled section still renders.
 */

export type Persona = "student_abroad" | "professional" | "university";
export type Intent =
  | "masters_abroad"
  | "job_abroad"
  | "switch_role"
  | "grow_in_place"
  | "program_insights";
export type MatchLevel = "exact_school" | "school_tier" | "field_only";
export type Confidence = "high" | "medium" | "low";

/** The only way a proportion is shown. share/ci are null when n < 10. */
export interface Count {
  k: number;
  n: number;
  display: string;
  share: number | null;
  ci: [number, number] | null;
  evidence_ids?: string[];
}

export interface Cohort {
  definition: string;
  filters: Record<string, unknown>;
  n_visible: number;
  match_level: MatchLevel;
  widened: boolean;
  widened_reason: string | null;
}

export interface Evidence {
  id: string;
  endpoint: string;
  filters: Record<string, unknown>;
  total_count: number;
  results_used: number;
  fetched_at: string;
  source: "live" | "cache" | "mock";
  note?: string | null;
}

/* ---------- Section data shapes ---------- */

export interface DistributionItem {
  label: string;
  count: number;
  share?: number | null;
  /** Marks the user's target (rendered inverted). */
  target?: boolean;
  /** Remainder groups (e.g. "Still in India", "Unknown") render as hollow cells. */
  remainder?: boolean;
}
export interface DistributionData {
  n: number;
  items: DistributionItem[];
  /** What one unit counts, e.g. "people" or "postings". People render as a waffle. */
  unit?: string;
  /** Short caption shown under the panel title. */
  caption?: string;
}

export type ColumnType = "text" | "int" | "count" | "share" | "years" | "badges";
export interface RankedColumn {
  key: string;
  label: string;
  type: ColumnType;
  /** Draw an inline cell bar for this numeric column. */
  bar?: boolean;
}
export type CellValue = string | number | null | Count | string[];
export interface RankedRow {
  id?: string;
  cells: Record<string, CellValue>;
  count?: Count;
  badges?: string[];
  you?: boolean;
  /** Folded "Other" row: kept at the bottom, muted. */
  rest?: boolean;
}
export interface RankedTableData {
  n?: number;
  columns: RankedColumn[];
  rows: RankedRow[];
  default_sort?: { key: string; dir: "asc" | "desc" };
  caption?: string;
}

export interface RouteNode {
  id: string;
  label: string;
  kind: string;
}
export interface RouteEdge {
  from: string;
  to: string;
  count: number;
}
export interface RoutesData {
  nodes: RouteNode[];
  edges: RouteEdge[];
  caption?: string;
}

export interface RouteStep {
  label: string;
  kind?: string;
  years?: number | null;
}
export interface RouteListItem {
  id: string;
  title?: string;
  steps: RouteStep[];
  people: Count | number;
  typical_years?: number | null;
  fit?: "fits_you" | "stretch" | "far";
  gaps: string[];
}
export interface RouteListData {
  routes: RouteListItem[];
  caption?: string;
}

export interface TimePoint {
  period: string;
  value: number;
}
export interface TimeSeries {
  key: string;
  label: string;
  points: TimePoint[];
}
export interface TimeseriesData {
  /** Single series shorthand. */
  points?: TimePoint[];
  /** Or several named series sharing periods. */
  series?: TimeSeries[];
  unit?: string;
  caption?: string;
}

export interface StatData {
  label: string;
  value?: number | null;
  count?: Count | null;
  unit?: string;
  /** Human display override, e.g. "4.2 entrants per opening". */
  display?: string;
  level?: "low" | "medium" | "high" | null;
  note?: string | null;
}

export interface TextData {
  text: string;
}

export interface KeywordItem {
  term: string;
  count: number;
  share?: number | null;
  /** In reverse-gps: true when the user's profile already lists it. */
  you_have?: boolean;
}
export interface KeywordsData {
  n?: number;
  items: KeywordItem[];
  caption?: string;
}

interface SectionBase<K extends string, D> {
  id: string;
  kind: K;
  title: string;
  data: D;
  evidence_ids?: string[];
}
export type Section =
  | SectionBase<"distribution", DistributionData>
  | SectionBase<"ranked_table", RankedTableData>
  | SectionBase<"routes", RoutesData>
  | SectionBase<"route_list", RouteListData>
  | SectionBase<"timeseries", TimeseriesData>
  | SectionBase<"stat", StatData>
  | SectionBase<"text", TextData>
  | SectionBase<"keywords", KeywordsData>;
export type SectionKind = Section["kind"];

export type ToolId =
  | "people_like_me"
  | "internship_chances"
  | "conversion_map"
  | "reverse_gps"
  | "routes_to_position"
  | "job_postings"
  | "indian_friendly"
  | "market_saturation";

export interface NextStep {
  label: string;
  tool: ToolId;
  params: Record<string, unknown>;
}

export interface ResultEnvelope {
  tool: ToolId;
  title: string;
  summary: string | null;
  cohort: Cohort | null;
  confidence: Confidence;
  coverage_note: string;
  data_date: string;
  sections: Section[];
  next_steps: NextStep[];
  warnings: string[];
  evidence: Evidence[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  hint?: string;
}

export type JobStatus = "queued" | "running" | "done" | "error";
export interface Job {
  job_id: string;
  tool: ToolId;
  status: JobStatus;
  progress: { step: string; done: number; total: number };
  result?: ResultEnvelope;
  error?: ApiErrorBody;
}

/* ---------- Onboarding ---------- */

export interface Education {
  school: string;
  degree: string;
  field: string;
  start_year: number | null;
  end_year: number | null;
  school_country?: string | null;
}
export interface Experience {
  company: string;
  company_id?: number | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  seniority?: string | null;
  function?: string | null;
}
export interface Person {
  name: string;
  headline: string;
  location: { city: string | null; country: string | null };
  education: Education[];
  experience: Experience[];
  skills: string[];
}
export interface Derived {
  undergrad_school: string | null;
  undergrad_field: string | null;
  undergrad_end_year: number | null;
  years_experience: number | null;
  current_company: string | null;
  current_title: string | null;
  persona_guess: Persona;
}
export interface ProfileResponse {
  profile_id: string;
  person: Person;
  derived: Derived;
  evidence: Evidence[];
}

export interface Goals {
  persona: Persona;
  intent: Intent | null;
  target_roles: string[];
  target_countries: string[];
  target_cities: string[];
  target_companies: string[];
  institution: string | null;
  programs: string[];
  constraints: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface ChatResponse {
  reply: string;
  done: boolean;
  goals: Goals;
  suggested_replies: string[];
}
export interface CompleteResponse {
  profile_id: string;
  home: { next_steps: NextStep[] };
}
export interface StoredProfile extends ProfileResponse {
  goals: Goals | null;
}

export interface Health {
  crustdata: "ok" | "missing_key" | "error";
  llm: "ok" | "missing_key" | "error";
}
