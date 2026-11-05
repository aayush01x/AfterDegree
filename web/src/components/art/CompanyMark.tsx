import { CellArt } from "./CellArt";
import { CellGrid, hashString } from "./grid";

type Motif = (w: number, h: number) => CellGrid;

/* Abstract marks (never real logos). Each motif scales to the grid it is given. */
const MOTIFS: Motif[] = [
  // stairs
  (w, h) => {
    const a = new CellGrid(w, h);
    const s = Math.max(2, Math.floor(w / 6));
    const ox = Math.floor((w - 4 * s) / 2), base = h - Math.max(1, Math.floor(h / 8));
    const step = Math.floor((base - 1) / 5);
    for (let i = 0; i < 4; i++) a.R(ox + i * s, base - step * (i + 2), s, step * (i + 2), i % 2 ? "light" : "sil");
    return a;
  },
  // nested frames
  (w, h) => {
    const a = new CellGrid(w, h);
    const sz = Math.min(w, h) - 2, x0 = Math.floor((w - sz) / 2), y0 = Math.floor((h - sz) / 2);
    for (let i = 0; i * 2 < sz; i += 2) {
      a.R(x0 + i, y0 + i, sz - 2 * i, sz - 2 * i, "sil");
      a.X(x0 + i + 1, y0 + i + 1, sz - 2 * i - 2, sz - 2 * i - 2);
    }
    return a;
  },
  // diagonal weave (cells, not lines)
  (w, h) => {
    const a = new CellGrid(w, h);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if ((x + y) % 5 < 2) a.set(x, y, "sil");
    return a;
  },
  // zigzag
  (w, h) => {
    const a = new CellGrid(w, h);
    const band = Math.max(3, Math.floor(h / 3));
    for (let x = 0; x < w; x++) {
      const y = [0, 1, 2, 1][x % 4];
      for (let r = 2; r + 2 < h - 1; r += band + 1) a.set(x, r + y, "sil");
    }
    a.R(0, h - 2, w, 1, "sil");
    return a;
  },
  // waves
  (w, h) => {
    const a = new CellGrid(w, h);
    for (let x = 0; x < w; x++) {
      const y = Math.round(1.4 * Math.sin(x * 0.8));
      for (let r = 3; r < h - 2; r += 4) a.set(x, r + y, "sil");
    }
    return a;
  },
  // double chevron
  (w, h) => {
    const a = new CellGrid(w, h);
    const n = Math.floor((h - 2) / 2);
    const ox = Math.floor((w - (n + 7)) / 2);
    for (let i = 0; i < n; i++)
      for (const dx of [0, 5]) {
        a.R(ox + dx + i, 1 + i, 2, 1, "sil");
        a.R(ox + dx + i, h - 2 - i, 2, 1, "sil");
      }
    return a;
  },
  // rising bars
  (w, h) => {
    const a = new CellGrid(w, h);
    const n = Math.max(4, Math.floor(w / 3));
    const ox = Math.floor((w - (n * 3 - 1)) / 2);
    const hs = [0.3, 0.5, 0.42, 0.66, 0.84, 0.58, 0.74];
    for (let i = 0; i < n; i++) {
      const bh = Math.max(2, Math.round((h - 2) * hs[i % hs.length]));
      a.R(ox + i * 3, h - 1 - bh, 2, bh, i === n - 1 ? "light" : "sil");
    }
    return a;
  },
  // concentric rings
  (w, h) => {
    const a = new CellGrid(w, h);
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const R = Math.min(cx, cy) - 1;
    for (let r = R; r > 0; r--) a.R(cx - r, cy - r, 2 * r, 2 * r, r % 2 ? "sil" : "field");
    a.R(cx - 1, cy - 1, 2, 2, "light");
    return a;
  },
  // stacked slabs
  (w, h) => {
    const a = new CellGrid(w, h);
    const ws = [0.5, 0.78, 0.38, 0.64, 0.86, 0.46];
    let y = 1;
    for (let i = 0; y + 1 < h - 1; i++, y += 3) a.R(2, y, Math.max(2, Math.round((w - 4) * ws[i % ws.length])), 2, i % 3 === 2 ? "light" : "sil");
    return a;
  },
  // checker block
  (w, h) => {
    const a = new CellGrid(w, h);
    const s = Math.max(2, Math.floor(Math.min(w, h) / 5));
    const n = Math.floor((Math.min(w, h) - 2) / s);
    const ox = Math.floor((w - n * s) / 2), oy = Math.floor((h - n * s) / 2);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) a.R(ox + i * s, oy + j * s, s, s, (i * j) % 3 === 1 ? "light" : "sil");
    return a;
  },
];

export interface CompanyMarkProps {
  name: string;
  shape?: "landscape" | "square";
  pitch?: number;
  className?: string;
}

/** Deterministic hue + motif for a company name. */
export function companyStyle(name: string) {
  const h = hashString(name.trim().toLowerCase());
  const hue = ((h >>> 8) % 8) + 1;
  return { motif: h % MOTIFS.length, field: `var(--art-${hue})`, on: `var(--art-${hue}-on)` };
}

/** An abstract cell mark derived from the company name. Never a real logo. */
export function CompanyMark({ name, shape = "landscape", pitch = 8, className }: CompanyMarkProps) {
  const { motif, field, on } = companyStyle(name);
  const [w, h] = shape === "square" ? [24, 24] : [16, 12];
  return <CellArt grid={MOTIFS[motif](w, h)} field={field} on={on} pitch={pitch} label={`Abstract mark for ${name}`} className={className} />;
}
