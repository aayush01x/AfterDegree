import type { JobPhase } from "@/hooks/useJob";
import type { Job } from "@/lib/types";
import { GridFill } from "./GridFill";
import styles from "./JobProgress.module.css";

export interface JobProgressProps {
  phase: JobPhase;
  job: Job | null;
  /** Cells in the fill grid. */
  cells?: number;
  size?: number;
  onOrange?: boolean;
  /** Shown under the grid while working. */
  note?: string;
}

/** Job progress as the grid filling. Announces each step politely. */
export function JobProgress({ phase, job, cells = 64, size = 14, onOrange = false, note }: JobProgressProps) {
  const total = job?.progress.total ?? 1;
  const done = phase === "done" ? total : (job?.progress.done ?? 0);
  const step = phase === "starting" || !job ? "Starting" : phase === "queued" ? "Waiting for a free slot" : job.progress.step;
  return (
    <div className={[styles.box, onOrange && styles.onOrange].filter(Boolean).join(" ")}>
      <div className={styles.line} role="status" aria-live="polite">
        <p className={styles.step}>{step}</p>
        {job && (
          <p className={styles.count}>
            Step {Math.min(done + 1, total)} of {total}
          </p>
        )}
      </div>
      <GridFill done={done} total={total} cells={cells} size={size} onOrange={onOrange} />
      <p className={styles.note}>{note ?? "Live searches can take up to a minute because the data source limits how fast we can ask. Saved searches come back at once."}</p>
    </div>
  );
}
