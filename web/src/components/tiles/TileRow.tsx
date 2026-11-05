"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Chevron } from "@/components/ui/Chevron";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import styles from "./TileRow.module.css";

export interface TileRowProps {
  title: ReactNode;
  /** Inline note after the heading (never an eyebrow above it). */
  note?: ReactNode;
  id?: string;
  /** Full-bleed dark band (the one active row on a screen). */
  band?: boolean;
  /** Dim the art of every tile that is not expanded. */
  dim?: boolean;
  headingLevel?: 2 | 3;
  /** Accessible name of the scroller; defaults to the title text. */
  label?: string;
  /** Short count right of the heading, before the controls (e.g. "5 cities"). */
  count?: ReactNode;
  /** Show the Example data chip after the heading (mock mode only). */
  example?: boolean;
  /** Scroller height: "auto" (default) or px. */
  height?: "auto" | number;
  className?: string;
  children: ReactNode;
}

/**
 * A heading with an inline note and working ‹ › controls over a horizontal,
 * snap-scrolling row of tiles that runs to the right edge (the last tile is cut).
 * Containers that pad their content set `--ad-row-bleed` to that padding so the
 * row (and its band) reaches the edges.
 */
export function TileRow({ title, note, id, band = false, dim = false, headingLevel = 2, label, count, example = false, height = "auto", className, children }: TileRowProps) {
  const auto = useId();
  const hid = id ?? `row-${auto}`;
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const H = headingLevel === 3 ? "h3" : "h2";

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const tiles = [...el.children] as HTMLElement[];
    const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
    const view = el.scrollLeft + pad;
    if (dir > 0) {
      // the first tile that is not fully visible becomes the first tile
      const next = tiles.find((t) => t.offsetLeft + t.offsetWidth > el.scrollLeft + el.clientWidth - 1);
      el.scrollTo({ left: next ? next.offsetLeft - pad : el.scrollWidth, behavior: "smooth" });
    } else {
      const target = view - el.clientWidth + pad * 2;
      const prev = tiles.find((t) => t.offsetLeft >= target - 1);
      el.scrollTo({ left: prev ? Math.max(0, prev.offsetLeft - pad) : 0, behavior: "smooth" });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const first = el.children[0] as HTMLElement | undefined;
      const step = (first?.offsetWidth ?? 160) + 32;
      el.scrollBy({ left: e.key === "ArrowRight" ? step : -step, behavior: "smooth" });
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      el.scrollTo({ left: e.key === "Home" ? 0 : el.scrollWidth, behavior: "smooth" });
    }
  };

  const name = label ?? (typeof title === "string" ? title : undefined);

  return (
    <section
      className={[styles.row, band ? `${styles.band} ad-surface-band` : styles.plain, dim && styles.dim, className].filter(Boolean).join(" ")}
      aria-labelledby={hid}
      data-dim={dim ? "" : undefined}
      data-band={band ? "" : undefined}
    >
      <div className={styles.head}>
        <H id={hid} className={styles.title}>
          {title}
        </H>
        {example && <ExampleBadge />}
        {note && <span className={styles.note}>{note}</span>}
        <span className={styles.end}>
          {count && <span className={styles.count}>{count}</span>}
          <span className={styles.ctls}>
            <button type="button" className={styles.ctl} aria-label={`Previous${name ? ` in ${name}` : ""}`} aria-controls={`${hid}-s`} disabled={atStart} onClick={() => page(-1)}>
              <Chevron dir="left" />
            </button>
            <button type="button" className={styles.ctl} aria-label={`Next${name ? ` in ${name}` : ""}`} aria-controls={`${hid}-s`} disabled={atEnd} onClick={() => page(1)}>
              <Chevron dir="right" />
            </button>
          </span>
        </span>
      </div>
      <div
        id={`${hid}-s`}
        ref={ref}
        className={styles.scroller}
        role="region"
        aria-label={name}
        aria-labelledby={name ? undefined : hid}
        tabIndex={0}
        onKeyDown={onKey}
        style={height === "auto" ? undefined : { height }}
      >
        {children}
      </div>
    </section>
  );
}
