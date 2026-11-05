import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";
import { Slash } from "./Slash";

type Variant = "primary" | "secondary" | "ghost";
interface VisualProps {
  variant?: Variant;
  size?: "md" | "sm";
  /** Show the diagonal mark. Defaults to true for primary and secondary. */
  slash?: boolean;
  children?: ReactNode;
}

function classes(variant: Variant, size: "md" | "sm", extra?: string) {
  return [styles.button, styles[variant], size === "sm" && styles.sm, extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  slash,
  loading = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: VisualProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const showSlash = slash ?? variant !== "ghost";
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
        showSlash && <Slash className={styles.slash} />
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  slash,
  children,
  className,
  href,
  ...rest
}: VisualProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const showSlash = slash ?? variant !== "ghost";
  return (
    <Link href={href} className={classes(variant, size, className)} {...rest}>
      <span>{children}</span>
      {showSlash && <Slash className={styles.slash} />}
    </Link>
  );
}
