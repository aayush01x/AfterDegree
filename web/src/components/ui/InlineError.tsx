import styles from "./InlineError.module.css";
import { Button } from "./Button";

/** Errors name the problem and the recovery. Always on white. */
export function InlineError({
  title = "That didn't work",
  message,
  hint,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className={styles.box} role="alert">
      <p className={styles.title}>
        <span className={styles.mark} aria-hidden="true" />
        {title}
      </p>
      <p className={styles.message}>{message}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      {onRetry && (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
