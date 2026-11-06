"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "./ThemeSwitcher.module.css";

export const THEMES = [
  { id: "blueprint", label: "Blueprint Paper" },
  { id: "night", label: "Night Ink" },
  { id: "signal", label: "Signal Orange" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_KEY = "afterdegree.theme";

function readTheme(): ThemeId {
  const current = document.documentElement.dataset.palette;
  return (THEMES.find((t) => t.id === current)?.id ?? "blueprint") as ThemeId;
}

/** Re-render when the palette attribute on <html> changes. */
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette"] });
  return () => obs.disconnect();
}

/** Fixed theme picker at the top of every page; the choice is remembered on this device. */
export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "blueprint" as ThemeId);

  // Restore the saved theme on load (writes the DOM attribute only; the store above re-reads it).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved && THEMES.some((t) => t.id === saved)) document.documentElement.dataset.palette = saved;
    } catch {
      /* storage blocked */
    }
  }, []);

  const change = (id: ThemeId) => {
    document.documentElement.dataset.palette = id;
    try {
      window.localStorage.setItem(THEME_KEY, id);
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
  };

  return (
    <div className={styles.switcher}>
      <label htmlFor="ad-theme" className={styles.label}>
        Theme
      </label>
      <select id="ad-theme" className={styles.select} value={theme} onChange={(e) => change(e.target.value as ThemeId)}>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
