"use client";

import { useId, useState, type FormEvent } from "react";
import type { Goals, Intent, Persona } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import styles from "./Onboarding.module.css";

export const PERSONAS: { value: Persona; label: string }[] = [
  { value: "student_abroad", label: "Student going abroad" },
  { value: "professional", label: "Working professional" },
  { value: "university", label: "University" },
];

export const INTENTS: { value: Intent | ""; label: string }[] = [
  { value: "", label: "Not decided yet" },
  { value: "masters_abroad", label: "A master's abroad, then a job" },
  { value: "job_abroad", label: "A job abroad" },
  { value: "switch_role", label: "Switch to a different role" },
  { value: "grow_in_place", label: "Grow where I am" },
  { value: "program_insights", label: "See where our graduates go" },
];

type ListKey = "target_roles" | "target_countries" | "target_cities" | "target_companies" | "programs" | "constraints";

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className={styles.goalGroup} role="group" aria-labelledby={id}>
      <p className={styles.goalLabel} id={id}>
        {label}
      </p>
      {values.length ? (
        <div className={styles.chips}>
          {values.map((v) => (
            <Chip key={v} onRemove={() => onChange(values.filter((x) => x !== v))} removeLabel={`Remove ${v} from ${label.toLowerCase()}`}>
              {v}
            </Chip>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Nothing yet. Mention it in the chat or add it here.</p>
      )}
      <form className={styles.inlineAdd} onSubmit={add}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={`Add to ${label.toLowerCase()}`} />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}

/** Live, editable view of what the mentor has understood. */
export function GoalsEditor({ goals, onEdit }: { goals: Goals; onEdit: <K extends keyof Goals>(key: K, value: Goals[K]) => void }) {
  const personaId = useId();
  const university = goals.persona === "university";
  const list = (key: ListKey, label: string, placeholder: string) => (
    <ListEditor label={label} values={goals[key]} onChange={(v) => onEdit(key, v)} placeholder={placeholder} />
  );
  return (
    <div className={styles.goals}>
      <div className={styles.goalGroup} role="group" aria-labelledby={personaId}>
        <p className={styles.goalLabel} id={personaId}>
          You are
        </p>
        <div className={styles.segmented}>
          {PERSONAS.map((p) => (
            <button key={p.value} type="button" className={styles.segment} aria-pressed={goals.persona === p.value} onClick={() => onEdit("persona", p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {university ? (
        <>
          <div className={styles.goalGroup}>
            <label className={styles.goalLabel} htmlFor="goal-institution">
              Institution you represent
            </label>
            <div className={styles.inlineAdd}>
              <input id="goal-institution" value={goals.institution ?? ""} onChange={(e) => onEdit("institution", e.target.value || null)} placeholder="e.g. VIT Vellore" />
            </div>
          </div>
          {list("programs", "Programs to follow", "e.g. BTech Computer Science")}
          {list("target_countries", "Countries to watch", "e.g. Germany")}
        </>
      ) : (
        <>
          <Select
            label="What you want next"
            options={INTENTS.filter((i) => i.value !== "program_insights").map((i) => ({ value: i.value, label: i.label }))}
            value={goals.intent ?? ""}
            onChange={(e) => onEdit("intent", (e.target.value || null) as Intent | null)}
          />
          {list("target_roles", "Target roles", "e.g. Data Engineer")}
          {list("target_countries", "Countries", "e.g. Germany")}
          {list("target_cities", "Cities", "e.g. Berlin")}
          {list("constraints", "Keep in mind", "e.g. budget under 30 lakh")}
        </>
      )}
    </div>
  );
}
