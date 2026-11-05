import type { PersonStep } from "@/lib/drill-types";

export type Stage = "study" | "work-in" | "masters" | "intern" | "fulltime";

export const STAGES: { id: Stage; label: string; token: string }[] = [
  { id: "study", label: "Study at home", token: "var(--stage-study)" },
  { id: "work-in", label: "Work at home", token: "var(--stage-work-in)" },
  { id: "masters", label: "Master’s abroad", token: "var(--stage-masters)" },
  { id: "intern", label: "Intern / working student", token: "var(--stage-intern)" },
  { id: "fulltime", label: "Full-time abroad", token: "var(--stage-fulltime)" },
];

export const stageToken = (s: Stage) => `var(--stage-${s})`;
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;

/** The home country of a path: where the first education step happened (default India). */
export function homeCountry(steps: PersonStep[]): string {
  const first = [...steps].sort((a, b) => (a.start_year ?? 9999) - (b.start_year ?? 9999)).find((s) => s.country);
  return first?.country ?? "India";
}

/** Which career stage a step belongs to. */
export function stageOf(step: PersonStep, home = "India"): Stage {
  const abroad = !!step.country && step.country.toLowerCase() !== home.toLowerCase();
  if (step.kind === "internship" || /working student|intern|werkstudent|trainee|thesis/i.test(step.title ?? "")) return "intern";
  if (step.kind === "education") return abroad ? "masters" : "study";
  return abroad ? "fulltime" : "work-in";
}

/** Stages active in each year from..to (at most two per year, in start order). */
export function stagesByYear(steps: PersonStep[], from: number, to: number): Stage[][] {
  const home = homeCountry(steps);
  const now = new Date().getFullYear();
  const out: Stage[][] = [];
  for (let y = from; y <= to; y++) {
    const active = steps
      .filter((s) => s.start_year != null && s.start_year <= y && (s.end_year ?? now) >= y)
      .sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0));
    const list: Stage[] = [];
    for (const s of active) {
      const st = stageOf(s, home);
      if (!list.includes(st)) list.push(st);
    }
    // When a year spans a move, keep where they came from and where they went.
    out.push(list.length > 2 ? [list[0], list[list.length - 1]] : list);
  }
  return out;
}

/** The year span of a path, clamped to a sensible window. */
export function pathSpan(steps: PersonStep[], maxYears = 9): [number, number] {
  const now = new Date().getFullYear();
  const starts = steps.map((s) => s.start_year).filter((y): y is number => y != null);
  const ends = steps.map((s) => s.end_year ?? now);
  const to = Math.min(now, Math.max(...ends, ...starts, now - 1));
  const from = Math.max(Math.min(...starts, to), to - maxYears + 1);
  return [from, to];
}
