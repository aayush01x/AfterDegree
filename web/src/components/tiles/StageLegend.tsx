import { STAGES, type Stage } from "@/components/art/stages";
import styles from "./StageLegend.module.css";

/** Swatches for the career-stage colours used by CareerStrip and PersonTile. */
export function StageLegend({ stages, tone = "paper" }: { stages?: Stage[]; tone?: "paper" | "band" }) {
  const list = stages ? STAGES.filter((s) => stages.includes(s.id)) : STAGES;
  return (
    <ul role="list" className={[styles.legend, tone === "band" && styles.band].filter(Boolean).join(" ")} aria-label="Career stages">
      {list.map((s) => (
        <li key={s.id}>
          <i style={{ background: s.token }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
