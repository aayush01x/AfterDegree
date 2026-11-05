"use client";
// Privacy note and the next step (a tool run with the drill's context) at the end of a drill page.
import type { DrillResultExtras } from "@/lib/drill-types";
import type { ToolId } from "@/lib/types";
import { TOOLS, toolHref } from "@/lib/tools";
import { ButtonLink } from "@/components/ui/Button";
import { CellAvatar } from "@/components/art/CellAvatar";
import styles from "./Drill.module.css";

const isTool = (id: string): id is ToolId => TOOLS.some((t) => t.id === id);

export function DrillFooter({ steps, place }: { steps?: DrillResultExtras["next_steps"]; place?: string }) {
  const valid = (steps ?? []).filter((s) => isTool(s.tool));
  return (
    <footer className={styles.footer}>
      <div className={styles.privacy}>
        <CellAvatar seed={place ?? "privacy"} cells={4} cell={6} />
        <p>We never show names or profile links. Paths are anonymised to years only, and listed only when at least 5 people match.</p>
      </div>
      {valid.length > 0 && (
        <div className={styles.footerActions}>
          {valid.map((s, i) => (
            <ButtonLink key={s.label} href={toolHref(s.tool as ToolId, s.params)} variant={i === 0 ? "primary" : "secondary"}>
              {s.label}
            </ButtonLink>
          ))}
        </div>
      )}
    </footer>
  );
}
