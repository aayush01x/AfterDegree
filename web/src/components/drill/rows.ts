// Reads breakdown rows (label, count, drill token) out of any drill section, whatever its kind.
import type { DrillResultFull, DrillStep, DrillToken, RowPreview } from "@/lib/drill-types";
import type { Evidence, RankedRow, Section } from "@/lib/types";
import { isCount } from "@/lib/count";
import { IS_MOCK } from "@/lib/api";

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  drill?: DrillToken;
  preview?: RowPreview["preview"];
  rest?: boolean;
  you?: boolean;
  badges?: string[];
  postingUrl?: string | null;
}

function tokenOf(x: unknown): DrillToken | undefined {
  if (!x || typeof x !== "object") return undefined;
  const d = (x as { drill?: unknown }).drill as DrillToken | undefined;
  return d && typeof d.tool === "string" && Array.isArray(d.path) ? d : undefined;
}

function rowLabel(section: Extract<Section, { kind: "ranked_table" }>, row: RankedRow): string {
  const col = section.data.columns.find((c) => c.type === "text");
  const v = col ? row.cells[col.key] : null;
  return typeof v === "string" ? v : String(row.id ?? "");
}

function rowCount(section: Extract<Section, { kind: "ranked_table" }>, row: RankedRow): number {
  if (row.count) return row.count.k;
  const col = section.data.columns.find((c) => c.type === "int" || c.type === "count");
  const v = col ? row.cells[col.key] : null;
  if (typeof v === "number") return v;
  if (isCount(v)) return v.k;
  return 0;
}

export function rowsOf(section: Section): BreakdownRow[] {
  if (section.kind === "distribution") {
    return section.data.items.map((it, i) => ({
      key: `${it.label}-${i}`,
      label: it.label,
      count: it.count,
      drill: tokenOf(it),
      preview: (it as RowPreview).preview,
      rest: it.remainder,
      you: it.target,
    }));
  }
  if (section.kind === "ranked_table") {
    return section.data.rows.map((row, i) => ({
      key: `${row.id ?? i}`,
      label: rowLabel(section, row),
      count: rowCount(section, row),
      drill: tokenOf(row),
      preview: (row as RowPreview).preview,
      rest: row.rest,
      you: row.you,
      badges: row.badges,
      postingUrl: (row as { posting_url?: string | null }).posting_url,
    }));
  }
  return [];
}

/** The dimension a row opens (the last step of its token), if any. */
export const dimOf = (row: BreakdownRow): DrillStep["dimension"] | undefined => row.drill?.path[row.drill.path.length - 1]?.dimension;

/** Sections whose rows open the next level: shown as tile rows. */
export function isBreakdown(section: Section): boolean {
  const rows = rowsOf(section);
  return rows.length > 0 && rows.some((r) => r.drill);
}

export const sectionById = (r: DrillResultFull, id: string) => r.sections.find((s) => s.id === id);

/** Example data: mock mode, or fixtures the engine marked as mock. */
export function isExample(evidence?: Evidence[]): boolean {
  return IS_MOCK || !!evidence?.some((e) => e.source === "mock");
}

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
