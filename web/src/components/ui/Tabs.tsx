"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ label, tabs, defaultTab }: { label: string; tabs: TabItem[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list}>
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-controls={`${base}-panel-${t.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className={styles.panel}
        >
          {t.id === active && t.content}
        </div>
      ))}
    </div>
  );
}
