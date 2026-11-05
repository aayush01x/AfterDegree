import { useId, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, hint, error, options, id, className, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errId = error ? `${selectId}-err` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={[styles.control, styles.select, error && styles.invalid].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errId, hintId].filter(Boolean).join(" ") || undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errId} className={styles.error}>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
