import { CellArt } from "./CellArt";
import { CellGrid, hashString, rng } from "./grid";

export interface RouteArtProps {
  /** Number of steps (nodes) on the path. */
  steps?: number;
  /** Explicit run lengths per step (cells). */
  runs?: number[];
  hue?: 1 | 2 | 3 | 4;
  /** Override the field (token expression). */
  field?: string;
  cols?: number;
  rows?: number;
  pitch?: number;
  label?: string;
  /** Seeds the run lengths when `runs` is not given. */
  seed?: string;
  className?: string;
}

function routeGrid(cols: number, rows: number, runs: number[]) {
  const a = new CellGrid(cols, rows);
  const n = runs.length;
  const hiY = 1, loY = rows - 3;
  const ys = runs.map((_, i) => (n === 1 ? loY : Math.round(loY - ((loY - hiY) * i) / (n - 1))));
  let x = 1;
  runs.forEach((L, i) => {
    const y = ys[i];
    a.R(x, y, L, 1, "path");
    if (i < n - 1) a.R(x + L - 1, ys[i + 1], 1, y - ys[i + 1] + 1, "path");
    a.R(x, y - 1, 3, 3, "path").R(x + 1, y, 1, 1, "node");
    x += L - 1;
  });
  const last = ys[n - 1];
  a.R(x - 2, last - 1, 3, 3, "node").R(x - 1, last, 1, 1, "path");
  return a;
}

function splitRuns(cols: number, steps: number, seed: string) {
  const r = rng(hashString(seed));
  const total = cols - 3 + steps - 1;
  const weights = Array.from({ length: steps }, () => 0.75 + r() * 0.5);
  const sum = weights.reduce((s, w) => s + w, 0);
  const runs = weights.map((w) => Math.max(4, Math.floor((w / sum) * total)));
  return runs;
}

/** A stepped cell path: one node per step, rising left to right. */
export function RouteArt({ steps = 3, runs, hue = 1, field, cols = 44, rows = 12, pitch = 8, label, seed = "route", className }: RouteArtProps) {
  const r = runs ?? splitRuns(cols, Math.max(1, Math.min(steps, 5)), seed);
  return (
    <CellArt
      grid={routeGrid(cols, rows, r)}
      field={field ?? `var(--route-${hue})`}
      pitch={pitch}
      align="center"
      label={label ?? `${r.length}-step route drawn as a stepped cell path`}
      className={className}
    />
  );
}
