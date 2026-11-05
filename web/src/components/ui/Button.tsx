import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";
import { Chevron } from "./Chevron";
import { Slash } from "./Slash";

type Variant = "primary" | "secondary" | "ghost" | "accent";
interface VisualProps {
  variant?: Variant;
  size?: "md" | "sm" | "lg";
  /** Show the diagonal mark. Defaults to true for primary only. */
  slash?: boolean;
  /** Show a chevron instead (drill / "see more" actions). */
  chevron?: boolean;
  children?: ReactNode;
}

function classes(variant: Variant, size: "md" | "sm" | "lg", extra?: string) {
  return [styles.button, styles[variant], size !== "md" && styles[size], extra].filter(Boolean).join(" ");
}

function Mark({ variant, slash, chevron }: { variant: Variant; slash?: boolean; chevron?: boolean }) {
  if (chevron) return <Chevron className={styles.slash} />;
  if (slash ?? variant === "primary") return <Slash className={styles.slash} />;
  return null;
}

export function Button({
  variant = "primary",
  size = "md",
  slash,
  chevron,
  loading = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: VisualProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={classes(variant, size, [loading && styles.loading, className].filter(Boolean).join(" "))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span>{children}</span>
      {loading ? (
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <Mark variant={variant} slash={slash} chevron={chevron} />
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  slash,
  chevron,
  children,
  className,
  href,
  ...rest
}: VisualProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={classes(variant, size, className)} {...rest}>
      <span>{children}</span>
      <Mark variant={variant} slash={slash} chevron={chevron} />
    </Link>
  );
}
