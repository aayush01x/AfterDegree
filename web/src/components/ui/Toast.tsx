"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

type Tone = "info" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}
const ToastCtx = createContext<{ show: (message: string, tone?: Tone) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={[styles.toast, t.tone === "error" && styles.error].filter(Boolean).join(" ")}>
            <span>{t.message}</span>
            <button type="button" className={styles.close} onClick={() => dismiss(t.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
