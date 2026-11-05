import { useId, type InputHTMLAttributes } from "react";
import styles from "./Field.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Show "(optional)" after the label. */
  optional?: boolean;
}

export function Input({ label, hint, error, optional, id, className, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-err` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      <input
        id={inputId}
        className={[styles.control, error && styles.invalid].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errId, hintId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
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
