const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-06" or ISO timestamp → "6 Nov 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown date";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d ? Number(d) + " " : ""}${MONTHS[Number(mo) - 1]} ${y}`;
}

/** "2022-07" → "Jul 2022"; null → "now". */
export function formatMonth(ym: string | null | undefined): string {
  if (!ym) return "now";
  return formatDate(ym.slice(0, 7));
}

export const nf = new Intl.NumberFormat("en-IN");
export const fmtInt = (n: number) => nf.format(Math.round(n));
export const fmtPct = (x: number | null | undefined) =>
  x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
