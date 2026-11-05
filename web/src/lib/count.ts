import type { Count } from "./types";

/**
 * Build a contract Count with a 95% Wilson interval.
 * n < 10: share and ci are null and the display says it is too few to compare.
 */
export function makeCount(k: number, n: number, evidence_ids: string[] = []): Count {
  if (n < 10) {
    return { k, n, display: `${k} of ${n} (too few to compare)`, share: null, ci: null, evidence_ids };
  }
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    k,
    n,
    display: `at least ${k} of ${n}`,
    share: Math.round(p * 1000) / 1000,
    ci: [r(centre - half), r(centre + half)],
    evidence_ids,
  };
}

export const isCount = (v: unknown): v is Count =>
  typeof v === "object" && v !== null && "k" in v && "n" in v && "display" in v;
