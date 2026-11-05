"use client";

import { useSyncExternalStore } from "react";

import { IS_MOCK } from "./api";

const KEY = "afterdegree.profile_id";
const listeners = new Set<() => void>();
let demoChecked = false;

/** Mock mode only: `?demo=riya` or `?demo=anjali` on any route seeds that mock profile, so screens can be opened directly. */
function seedDemo() {
  if (demoChecked || !IS_MOCK) return;
  demoChecked = true;
  try {
    const who = new URLSearchParams(window.location.search).get("demo");
    if (who === "riya" || who === "anjali") window.localStorage.setItem(KEY, `p_demo_${who}`);
  } catch {
    /* storage blocked */
  }
}

function read(): string | null {
  seedDemo();
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setProfileId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session still works until reload */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The stored profile id. `undefined` while not yet known (server render),
 * `null` when no profile exists (first run).
 */
export function useProfileId(): string | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
