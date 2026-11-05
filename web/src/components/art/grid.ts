/**
 * A tiny cell canvas for building art from grid cells. Cells hold a colour
 * *slot* (never a colour); CellArt maps slots to palette tokens.
 */
export type Slot = "sil" | "ink" | "light" | "sun" | "tint" | "deep" | "shade" | "glow" | "water" | "field" | "path" | "node";

export class CellGrid {
  readonly w: number;
  readonly h: number;
  readonly cells = new Map<number, Slot>();
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }
  private key(x: number, y: number) {
    return y * this.w + x;
  }
  set(x: number, y: number, s: Slot) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.cells.set(this.key(x, y), s);
    return this;
  }
  get(x: number, y: number): Slot | undefined {
    return this.cells.get(this.key(x, y));
  }
  /** Fill a rectangle. */
  R(x: number, y: number, w: number, h: number, s: Slot) {
    for (let xx = x; xx < x + w; xx++) for (let yy = y; yy < y + h; yy++) this.set(xx, yy, s);
    return this;
  }
  /** Clear back to the field. */
  X(x: number, y: number, w = 1, h = 1) {
    for (let xx = x; xx < x + w; xx++) for (let yy = y; yy < y + h; yy++) this.cells.delete(this.key(xx, yy));
    return this;
  }
  /** Disc (or ring) of cells. */
  C(cx: number, cy: number, r: number, s: Slot, ring = false) {
    for (let x = 0; x < this.w; x++)
      for (let y = 0; y < this.h; y++) {
        const d = Math.hypot(x - cx, y - cy);
        if (ring ? Math.abs(d - r) < 0.62 : d <= r + 0.3) this.set(x, y, s);
      }
    return this;
  }
  /** Punch a window pattern into a block. */
  windows(x: number, y: number, w: number, h: number, s: Slot, step = 2) {
    for (let yy = y + 1; yy < y + h - 1; yy += step) for (let xx = x + 1; xx < x + w - 1; xx += step) this.set(xx, yy, s);
    return this;
  }
  /** Copy another grid in at an offset. */
  paste(g: CellGrid, ox: number, oy: number) {
    g.cells.forEach((s, k) => this.set(ox + (k % g.w), oy + Math.floor(k / g.w), s));
    return this;
  }
  /** Draw from rows of characters; `map` turns a character into a slot ("." = field). */
  rows(lines: string[], map: Record<string, Slot>, ox = 0, oy = 0) {
    lines.forEach((line, y) => [...line].forEach((ch, x) => map[ch] && this.set(ox + x, oy + y, map[ch])));
    return this;
  }
}

/** Stable 32-bit hash for deterministic art from a name. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG. */
export function rng(seed: number) {
  let r = seed || 1;
  return () => {
    r = (Math.imul(r, 1103515245) + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
}
