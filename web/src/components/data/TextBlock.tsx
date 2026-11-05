import type { TextData } from "@/lib/types";

/** A short paragraph from the engine (method notes, interpretation). */
export function TextBlock({ data }: { data: TextData }) {
  const paras = (data.text ?? "").split(/\n{2,}/).filter(Boolean);
  return (
    <div style={{ display: "grid", gap: "var(--ad-space-1)", maxWidth: "68ch", fontSize: "var(--ad-text-body)", lineHeight: "24px" }}>
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
