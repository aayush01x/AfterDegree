// Drill tokens travel in the URL as base64url(JSON) so a drill page is shareable and back-button friendly.
import type { DrillContext, DrillStep, DrillToken } from "@/lib/drill-types";

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeToken(token: DrillToken): string {
  return toBase64Url(JSON.stringify(token));
}

export function decodeToken(raw: string | null | undefined): DrillToken | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(fromBase64Url(raw)) as DrillToken;
    if (!t || typeof t.tool !== "string" || !Array.isArray(t.path)) return null;
    return { tool: t.tool, params: t.params ?? {}, path: t.path };
  } catch {
    return null;
  }
}

export const drillHref = (token: DrillToken) => `/explore?d=${encodeToken(token)}`;

export const personHref = (id: string, from?: DrillToken | null) =>
  `/people/${encodeURIComponent(id)}${from ? `?from=${encodeToken(from)}` : ""}`;

/** Stable key for caching a drill result per token. */
export const tokenKey = (token: DrillToken) => JSON.stringify([token.tool, token.params, token.path]);

/** The token for an earlier level of the same drill (index = how many path steps to keep). */
export function tokenAtLevel(token: DrillToken, keep: number): DrillToken {
  return { ...token, path: token.path.slice(0, keep) };
}

export const lastStep = (token: DrillToken | null | undefined): DrillStep | undefined =>
  token?.path[token.path.length - 1];

/** Label → origin param keys, used only when the engine did not say which param a filter came from. */
const FILTER_KEYS: [RegExp, string[]][] = [
  [/college|school|institution|university/i, ["school", "scope.school", "institution"]],
  [/field|degree|programme|program/i, ["field", "scope.field", "programs"]],
  [/experience|years/i, ["exp_band"]],
  [/company|employer/i, ["company", "scope.company"]],
  [/country/i, ["country", "scope.country"]],
  [/city/i, ["city", "scope.city"]],
  [/role|intern|title|position/i, ["role", "scope.role"]],
  [/match|like you/i, ["match"]],
  [/goal/i, ["goal_text", "goal"]],
];

function dropKey(params: Record<string, unknown>, dotted: string): Record<string, unknown> {
  const [head, ...rest] = dotted.split(".");
  if (!(head in params)) return params;
  const out = { ...params };
  if (!rest.length) {
    delete out[head];
    return out;
  }
  const inner = out[head];
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    out[head] = dropKey(inner as Record<string, unknown>, rest.join("."));
  }
  return out;
}

const hasKey = (params: Record<string, unknown>, dotted: string): boolean => {
  let cur: unknown = params;
  for (const k of dotted.split(".")) {
    if (!cur || typeof cur !== "object" || !(k in (cur as object))) return false;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur !== undefined && cur !== null && cur !== "";
};

type Filter = DrillContext["filters"][number];

function keysFor(token: DrillToken, filter: Filter): string[] {
  if (filter.param) return [filter.param];
  const hit = FILTER_KEYS.find(([re]) => re.test(filter.label));
  return hit ? hit[1].filter((k) => hasKey(token.params, k)) : [];
}

/** A new token for the same drill with one inherited filter dropped. */
export function withoutFilter(token: DrillToken, filter: Filter): DrillToken {
  if (filter.drill) return filter.drill;
  return { ...token, params: keysFor(token, filter).reduce(dropKey, token.params) };
}

/** Drop every inherited filter. */
export function withoutAllFilters(token: DrillToken, filters: Filter[]): DrillToken {
  const keys = filters.flatMap((f) => keysFor(token, f));
  return { ...token, params: keys.reduce(dropKey, token.params) };
}
