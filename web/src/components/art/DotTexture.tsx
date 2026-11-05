import type { ReactNode } from "react";

/** Offset-dot texture box (loading, empty, "too few people"). Same as the global `.ad-dots` class. */
export function DotTexture({ className, children, as: Tag = "div" }: { className?: string; children?: ReactNode; as?: "div" | "span" | "section" }) {
  return <Tag className={["ad-dots", className].filter(Boolean).join(" ")}>{children}</Tag>;
}
