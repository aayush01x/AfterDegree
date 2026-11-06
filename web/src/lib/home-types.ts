/** Home ("Your plan") endpoints: engine/afterdegree/home.py. */

/** Read as: [lead] display label. `value` is set when display is a number. */
export interface Headline {
  display: string;
  label: string;
  value?: number | null;
  lead?: string | null;
  detail?: string | null;
  level?: "low" | "medium" | "high" | null;
}

export interface RunSummary {
  tool: string;
  job_id: string;
  params: Record<string, unknown>;
  finished_at: string;
  title: string;
  question: string;
  confidence?: string | null;
  headline?: Headline | null;
}

export interface RunsResponse {
  profile_id: string;
  runs: RunSummary[];
  recent: RunSummary[];
}

export type SnapshotStatus = "ok" | "too_few" | "needs_role" | "needs_country" | "needs_institution" | "unavailable";

export interface SnapshotTile {
  key: string;
  status: SnapshotStatus;
  label: string;
  value?: number | null;
  display?: string | null;
  lead?: string | null;
  detail?: string | null;
  n?: number | null;
  tool: string;
  params: Record<string, unknown>;
  evidence_ids: string[];
}

export interface SnapshotResponse {
  profile_id: string;
  persona: "student" | "university";
  goal: { role?: string | null; city?: string | null; country?: string | null; place?: string | null; institution?: string | null };
  tiles: SnapshotTile[];
  data_date: string;
  generated_at: string;
  cached: boolean;
  credits_used: number;
}
