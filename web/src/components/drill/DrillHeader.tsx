"use client";
// Breadcrumb (origin tool → each path step) and the inherited "Filtered by" chip row.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { DrillContext, DrillStep, DrillToken } from "@/lib/drill-types";
import type { ToolId } from "@/lib/types";
import { TOOLS, toolHref } from "@/lib/tools";
import { Chevron } from "@/components/ui/Chevron";
import { drillHref, tokenAtLevel, withoutAllFilters, withoutFilter } from "./token";
import styles from "./DrillHeader.module.css";

export interface DrillHeaderProps {
  token: DrillToken;
  context?: DrillContext | null;
  /** Path to show (defaults to the token's). */
  path?: DrillStep[];
  /** Extra current crumb after the path (the person page uses the person's headline). */
  current?: string;
  /** Show a dashed "next level" hint crumb. */
  next?: string | null;
  /** Right of the breadcrumb (evidence key, legend, prev/next). */
  aside?: ReactNode;
  /** Right of the chip row. */
  note?: ReactNode;
  /** Before the breadcrumb (e.g. the Example data chip on the person page). */
  lead?: ReactNode;
}

const isTool = (id: string): id is ToolId => TOOLS.some((t) => t.id === id);

function originHref(token: DrillToken): string {
  return isTool(token.tool) ? toolHref(token.tool, token.params) : "/home";
}

export function DrillHeader({ token, context, path = token.path, current, next, aside, note, lead }: DrillHeaderProps) {
  const router = useRouter();
  const filters = context?.filters ?? [];
  const originLabel = context?.origin_label ?? TOOLS.find((t) => t.id === token.tool)?.short ?? "Back";
  const lastIsCurrent = !current;
  const backHref = current
    ? drillHref({ ...token, path })
    : path.length > 1
      ? drillHref(tokenAtLevel({ ...token, path }, path.length - 1))
      : originHref(token);
  const backLabel = current ? path[path.length - 1]?.label ?? originLabel : path.length > 1 ? path[path.length - 2].label : originLabel;

  return (
    <div className={styles.head}>
      <div className={styles.crumbRow}>
        {lead}
        <nav aria-label="Where you are" className={styles.crumbNav}>
          <Link href={backHref} className={styles.back} aria-label={`Back to ${backLabel}`}>
            <Chevron dir="left" size={14} />
          </Link>
          <ol className={styles.crumbs}>
            <li>
              <Link href={originHref(token)} className={styles.crumbLink}>
                {originLabel}
              </Link>
            </li>
            {path.map((s, i) => {
              const isLast = i === path.length - 1;
              const here = isLast && lastIsCurrent;
              return (
                <li key={`${s.dimension}-${s.value}-${i}`}>
                  <Chevron dir="right" size={12} className={styles.sep} />
                  {here ? (
                    <span className={styles.here} aria-current="page">
                      {s.label}
                    </span>
                  ) : (
                    <Link href={drillHref(tokenAtLevel({ ...token, path }, i + 1))} className={styles.crumbLink}>
                      {s.label}
                    </Link>
                  )}
                </li>
              );
            })}
            {current && (
              <li>
                <Chevron dir="right" size={12} className={styles.sep} />
                <span className={styles.hereText} aria-current="page">
                  {current}
                </span>
              </li>
            )}
            {next && (
              <li aria-hidden="true" className={styles.nextCrumb}>
                <Chevron dir="right" size={12} className={styles.sep} />
                <span className={styles.next}>
                  {next} <small>next level</small>
                </span>
              </li>
            )}
          </ol>
        </nav>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {filters.length > 0 && (
        <div className={styles.filterRow}>
          <p className={styles.filterLabel} id="drill-filters">
            Filtered by
          </p>
          <ul className={styles.chips} aria-labelledby="drill-filters">
            {filters.map((f) => (
              <li key={`${f.label}:${f.value}`} className={styles.chip}>
                <span className={styles.chipText}>
                  {f.label}: <strong>{f.value}</strong>
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove filter ${f.label}: ${f.value}`}
                  onClick={() => router.push(drillHref({ ...withoutFilter(token, f), path }))}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              </li>
            ))}
            {filters.length > 1 && (
              <li>
                <button type="button" className={styles.clear} onClick={() => router.push(drillHref({ ...withoutAllFilters(token, filters), path }))}>
                  Clear filters
                </button>
              </li>
            )}
          </ul>
          {note && <p className={styles.note}>{note}</p>}
        </div>
      )}
    </div>
  );
}
