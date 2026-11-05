import { CellGrid, hashString, rng } from "./grid";

/* Cell drawings of places, ported from the approved blend mockups.
   portrait 16x28, landscape 16x12, wide 36x12 (cells). */

export type PlaceKey = "de" | "us" | "uk" | "ca" | "nl" | "in" | "other";
export type CityKey = "berlin" | "munich" | "walldorf" | "frankfurt" | "hamburg" | "bengaluru";

const COUNTRY_ALIASES: [PlaceKey, RegExp][] = [
  ["de", /^(germany|deutschland|de)$/],
  ["us", /^(united states( of america)?|usa|us|u\.s\.|america)$/],
  ["uk", /^(united kingdom|uk|u\.k\.|england|great britain|britain|scotland|wales)$/],
  ["ca", /^(canada|ca)$/],
  ["nl", /^(netherlands|the netherlands|nl|holland)$/],
  ["in", /^(india|still in india|in india|stayed in india|in)$/],
  ["other", /^(other|others|other countries|elsewhere|everywhere else|rest|unknown|abroad, other)$/],
];
const CITY_ALIASES: [CityKey, RegExp][] = [
  ["berlin", /^berlin\b/],
  ["munich", /^(munich|münchen|muenchen)\b/],
  ["walldorf", /^(walldorf|st\. leon-rot)\b/],
  ["frankfurt", /^frankfurt\b/],
  ["hamburg", /^hamburg\b/],
  ["bengaluru", /^(bengaluru|bangalore)\b/],
];
const CITY_COUNTRY: [PlaceKey, RegExp][] = [
  ["us", /^(new york|san francisco|seattle|boston|austin|chicago|los angeles|bay area|san jose|mountain view|sunnyvale)\b/],
  ["uk", /^(london|manchester|edinburgh|cambridge|oxford)\b/],
  ["ca", /^(toronto|vancouver|montreal|ottawa|calgary|waterloo)\b/],
  ["nl", /^(amsterdam|eindhoven|rotterdam|utrecht|the hague|delft)\b/],
  ["in", /^(hyderabad|pune|chennai|mumbai|delhi|gurugram|gurgaon|noida|vellore|kolkata)\b/],
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function countryKey(place: string): PlaceKey | null {
  const p = norm(place);
  for (const [k, re] of COUNTRY_ALIASES) if (re.test(p)) return k;
  return null;
}
export function cityKey(place: string): CityKey | null {
  const p = norm(place);
  for (const [k, re] of CITY_ALIASES) if (re.test(p)) return k;
  return null;
}
function cityCountry(place: string): PlaceKey | null {
  const p = norm(place);
  for (const [k, re] of CITY_COUNTRY) if (re.test(p)) return k;
  return null;
}

const CITY_FIELD: Record<CityKey, [string, string]> = {
  berlin: ["var(--art-de)", "var(--art-de-on)"],
  munich: ["var(--art-8)", "var(--art-8-on)"],
  walldorf: ["var(--art-7)", "var(--art-7-on)"],
  frankfurt: ["var(--art-4)", "var(--art-4-on)"],
  hamburg: ["var(--art-5)", "var(--art-5-on)"],
  bengaluru: ["var(--art-in)", "var(--art-in-on)"],
};

/** Field and silhouette tokens for a place. Unknown places get a stable hue from --art-1..8. */
export function placeColors(place: string): { field: string; on: string } {
  const c = cityKey(place);
  if (c) return { field: CITY_FIELD[c][0], on: CITY_FIELD[c][1] };
  const k = countryKey(place) ?? cityCountry(place);
  if (k) return { field: `var(--art-${k})`, on: `var(--art-${k}-on)` };
  const n = (hashString(norm(place)) % 8) + 1;
  return { field: `var(--art-${n})`, on: `var(--art-${n}-on)` };
}

/* ---------------- countries, portrait 16x28 ---------------- */

function germanyWide() {
  const a = new CellGrid(36, 12);
  a.C(17, 3, 2.2, "light");
  a.R(0, 9, 4, 3, "sil").R(4, 10, 3, 2, "sil").R(13, 8, 3, 4, "sil").R(16, 10, 4, 2, "sil").R(20, 9, 1, 3, "sil");
  a.X(1, 10).X(14, 9).X(14, 10);
  // Fernsehturm
  a.R(9, 0, 1, 3, "sil").R(8, 3, 3, 1, "sil").R(7, 4, 5, 2, "sil").R(8, 6, 3, 1, "sil");
  a.R(7, 5, 5, 1, "glow").R(9, 7, 1, 3, "sil").R(8, 10, 3, 2, "sil");
  // Brandenburg Gate
  a.R(27, 4, 1, 1, "sil").R(26, 5, 3, 1, "sil").R(22, 6, 11, 1, "sil").R(22, 7, 11, 1, "sil");
  for (const x of [22, 24, 26, 28, 30, 32]) a.R(x, 8, 1, 4, "sil");
  a.R(33, 10, 3, 2, "sil").R(34, 9, 2, 1, "sil");
  return a;
}

function germanyPortrait() {
  const a = new CellGrid(16, 28);
  a.C(12, 4, 2.2, "light");
  // tall TV tower
  a.R(5, 1, 1, 4, "sil").R(4, 5, 3, 1, "sil").R(3, 6, 5, 3, "sil").R(4, 9, 3, 1, "sil");
  a.R(3, 7, 5, 1, "glow").R(5, 10, 1, 8, "sil");
  // gate
  a.R(10, 13, 1, 1, "sil").R(9, 14, 3, 1, "sil").R(7, 15, 9, 2, "sil");
  for (const x of [7, 9, 11, 13, 15]) a.R(x, 17, 1, 5, "sil");
  // low city
  a.R(0, 20, 4, 8, "sil").R(4, 18, 2, 10, "sil").R(6, 22, 10, 6, "sil");
  for (let y = 21; y < 27; y += 2) a.X(1, y).X(2, y);
  for (let x = 7; x < 16; x += 2) a.X(x, 24);
  return a;
}

function usa() {
  const a = new CellGrid(16, 28);
  a.C(3.5, 5, 2.4, "sun");
  a.R(0, 15, 4, 13, "tint").R(1, 13, 2, 2, "tint");
  a.R(13, 10, 3, 18, "tint").R(14, 7, 1, 3, "tint");
  a.R(9, 2, 1, 5, "sil").R(8, 7, 3, 2, "sil").R(7, 9, 5, 3, "sil").R(6, 12, 7, 16, "sil");
  for (let y = 13; y < 27; y += 2) for (const x of [7, 9, 11]) a.X(x, y);
  for (let y = 17; y < 27; y += 3) a.X(1, y).X(14, y);
  return a;
}

function uk() {
  const a = new CellGrid(16, 28);
  a.C(12.5, 3.5, 1.7, "light");
  for (const tx of [2, 11]) {
    a.R(tx + 1, 5, 1, 2, "sil").R(tx, 7, 3, 1, "sil").R(tx, 8, 3, 14, "sil");
    for (const y of [10, 13, 16]) a.R(tx + 1, y, 1, 1, "light");
  }
  a.R(5, 9, 6, 1, "sil").R(5, 11, 6, 1, "sil").R(0, 18, 16, 1, "sil");
  for (const [x, y] of [[1, 11], [0, 13], [14, 11], [15, 13], [1, 15], [14, 15]]) a.R(x, y, 1, 1, "sil");
  a.R(1, 22, 4, 1, "deep").R(9, 22, 6, 1, "deep").R(0, 24, 7, 1, "deep").R(10, 24, 6, 1, "deep").R(3, 26, 9, 1, "deep");
  return a;
}

function mountains(w: number, h: number, sun = true) {
  const a = new CellGrid(w, h);
  const s = h / 28;
  if (sun) a.C(w * 0.75, h * 0.2, Math.max(1.4, 2.3 * Math.min(1, s * 1.6)), "sun");
  const backPeakX = Math.round(w * 0.8), backTop = Math.round(h * 0.54);
  for (let y = backTop; y < h; y++) {
    const hw = Math.floor((y - backTop) * 0.75 * Math.max(1, 28 / h / 1.4));
    a.R(backPeakX - hw, y, 2 * hw + 1, 1, "shade");
  }
  a.R(backPeakX, backTop, 1, 2, "light").R(backPeakX - 1, backTop + 1, 3, 1, "light");
  const peakX = Math.round(w * 0.32), top = Math.round(h * 0.32);
  for (let y = top; y < h; y++) {
    const hw = Math.floor((y - top) * 0.62 * Math.max(1, 28 / h / 1.4));
    a.R(peakX - hw, y, 2 * hw + 1, 1, "deep");
  }
  const cap = Math.max(2, Math.round(h * 0.14));
  for (let y = top; y < top + cap; y++) {
    const hw = Math.floor((y - top) * 0.62 * Math.max(1, 28 / h / 1.4));
    a.R(peakX - hw, y, 2 * hw + 1, 1, "light");
  }
  return a;
}

function gables(w: number, h: number) {
  const a = new CellGrid(w, h);
  if (h >= 20) a.C(w - 3.5, 3.5, 1.7, "light");
  const ground = h - 2;
  const house = (x0: number, hw: number, top: number) => {
    const mid = x0 + Math.floor(hw / 2);
    a.R(mid - (hw % 2 ? 0 : 1), top, hw % 2 ? 1 : 2, 1, "sil");
    a.R(x0 + 1, top + 1, hw - 2, 1, "sil").R(x0, top + 2, hw, h - top - 2, "sil");
    for (let y = top + 4; y < ground - 1; y += 3) for (let x = x0 + 1; x < x0 + hw - 1; x += 2) a.X(x, y);
  };
  const pattern: [number, number][] = [[5, 0.36], [6, 0.25], [5, 0.43], [6, 0.3], [5, 0.38], [6, 0.27]];
  let x = 0;
  for (let i = 0; x < w; i++) {
    const [hw, t] = pattern[i % pattern.length];
    house(x, hw, Math.round(h * t));
    x += hw;
  }
  a.R(0, ground, w, 2, "sil");
  for (let i = 0, xx = 2; xx < w; i++, xx += 5 + (i % 2)) a.X(xx, ground - 2, i % 2 ? 2 : 1, 2);
  return a;
}

function dome(w: number, h: number) {
  const a = new CellGrid(w, h);
  const cx = Math.floor(w / 2);
  if (h >= 20) {
    a.C(3, 4, 1.9, "sun");
    a.R(cx, 7, 1, 2, "sil");
    for (let x = 0; x < w; x++) for (let y = 9; y < 15; y++) if (Math.hypot(x - cx, (y - 14) * 1.1) <= 4.6) a.set(x, y, "sil");
    a.R(cx - 4, 15, 9, 2, "sil").R(2, 17, w - 3, 11, "sil");
    a.X(cx - 1, 20, 3, 6).X(4, 21, 2, 3).X(w - 5, 21, 2, 3).X(4, 25, 2, 1).X(w - 5, 25, 2, 1);
    a.R(0, 10, 1, 18, "sil").R(w - 1, 10, 1, 18, "sil").R(0, 9, 1, 1, "sil").R(w - 1, 9, 1, 1, "sil");
    return a;
  }
  // landscape (Bengaluru-style dome over a colonnade)
  a.C(2, 2, 1.4, "sun");
  for (let x = 0; x < w; x++) for (let y = 1; y < 6; y++) if (Math.hypot(x - cx, (y - 5) * 1.15) <= 3.6) a.set(x, y, "sil");
  a.R(cx, 0, 1, 1, "sil");
  a.R(2, 6, w - 3, 1, "sil").R(1, 7, w - 1, 1, "sil");
  for (let x = 2; x < w - 1; x += 2) a.R(x, 8, 1, 3, "sil");
  a.R(0, 11, w, 1, "sil");
  return a;
}

function globe(w: number, h: number) {
  const a = new CellGrid(w, h);
  const r = Math.min(w, h) / 2 - 1.6;
  const cx = (w - 1) / 2, cy = h >= 20 ? 13 : (h - 1) / 2;
  a.C(cx, cy, r, "sil", true);
  a.R(Math.round(cx), Math.round(cy - r), 1, Math.round(2 * r) + 1, "sil");
  a.R(Math.round(cx - r), Math.round(cy), Math.round(2 * r) + 1, 1, "sil");
  const q = r * 0.62;
  for (const [dx, dy] of [[-q, -q], [q, -q], [-q, q], [q, q]]) a.set(Math.round(cx + dx), Math.round(cy + dy), "sil");
  if (h >= 20) a.R(Math.round(cx) - 2, Math.round(cy + r) + 3, 5, 1, "sil").R(Math.round(cx), Math.round(cy + r) + 1, 1, 2, "sil");
  return a;
}

/* ---------------- cities, landscape 16x12 ---------------- */

function berlin() {
  const a = new CellGrid(16, 12);
  a.paste(germanyWide(), 0, 0);
  a.C(14, 2, 1.6, "light");
  return a;
}

function walldorf() {
  const a = new CellGrid(16, 12);
  a.C(12, 2.5, 1.6, "light");
  a.R(1, 5, 6, 5, "sil").windows(1, 5, 6, 5, "light");
  a.R(8, 3, 7, 7, "sil").windows(8, 3, 7, 7, "light");
  for (let x = 0; x < 16; x++) {
    a.set(x, 10, "glow");
    a.set(x, 11, x % 2 ? "sun" : "glow");
  }
  return a;
}

function munich() {
  const a = new CellGrid(16, 12);
  a.C(8, 2, 1.5, "glow");
  for (const tx of [3, 10]) {
    a.R(tx, 4, 3, 7, "sil").R(tx, 3, 3, 1, "sil").R(tx + 1, 1, 1, 2, "sil");
    a.set(tx + 1, 6, "light").set(tx + 1, 8, "light");
  }
  a.R(6, 7, 4, 4, "sil").set(7, 9, "light").set(8, 9, "light");
  a.R(0, 11, 16, 1, "sil").R(0, 10, 3, 1, "sil").R(13, 10, 3, 1, "sil");
  return a;
}

function frankfurt() {
  const a = new CellGrid(16, 12);
  const towers: [number, number, number, "sil" | "light"][] = [
    [0, 8, 2, "sil"], [2, 4, 3, "sil"], [5, 6, 2, "light"], [7, 1, 3, "sil"], [10, 5, 2, "sil"], [12, 3, 3, "light"], [15, 9, 1, "sil"],
  ];
  for (const [x, y, w, s] of towers) {
    a.R(x, y, w, 12 - y, s);
    if (s === "sil" && w >= 2) for (let yy = y + 1; yy < 11; yy += 2) a.set(x + Math.floor(w / 2), yy, "sun");
  }
  a.set(8, 0, "sil");
  return a;
}

function hamburg() {
  const a = new CellGrid(16, 12);
  a.R(3, 1, 1, 8, "sil").R(1, 1, 10, 1, "sil").R(9, 2, 1, 2, "sil").R(8, 4, 3, 2, "glow");
  a.R(12, 3, 1, 6, "sil").R(10, 3, 6, 1, "sil").R(14, 4, 1, 2, "sil");
  const box: ("glow" | "light" | "sil")[] = ["glow", "light", "sil", "glow", "glow", "light", "sil", "light"];
  box.forEach((s, i) => a.set(5 + i, 8, s));
  a.R(0, 9, 16, 1, "sil").R(0, 10, 16, 2, "deep");
  for (let x = 0; x < 16; x += 3) a.set(x, 10, "tint");
  for (let x = 1; x < 16; x += 3) a.set(x, 11, "light");
  return a;
}

function genericCity(seed: string) {
  const a = new CellGrid(16, 12);
  const r = rng(hashString(seed));
  if (r() > 0.4) a.C(2 + Math.floor(r() * 12), 2, 1.4, "light");
  let x = 0;
  while (x < 16) {
    const w = 2 + Math.floor(r() * 3);
    const top = 3 + Math.floor(r() * 6);
    a.R(x, top, w, 12 - top, "sil");
    if (w >= 3) a.windows(x, top, w, 12 - top, "light");
    x += w + (r() > 0.7 ? 1 : 0);
  }
  return a;
}

/* ---------------- shape resolution ---------------- */

export type PlaceShape = "portrait" | "landscape" | "wide";

const PORTRAIT: Record<PlaceKey, () => CellGrid> = {
  de: germanyPortrait,
  us: usa,
  uk,
  ca: () => mountains(16, 28),
  nl: () => gables(16, 28),
  in: () => dome(16, 28),
  other: () => globe(16, 28),
};
const LANDSCAPE: Record<PlaceKey, () => CellGrid> = {
  de: berlin,
  us: () => crop(usa(), 0, 16, 16, 12),
  uk: () => crop(uk(), 0, 8, 16, 12),
  ca: () => mountains(16, 12, false),
  nl: () => gables(16, 12),
  in: () => dome(16, 12),
  other: () => globe(16, 12),
};
const CITY: Record<CityKey, () => CellGrid> = { berlin, munich, walldorf, frankfurt, hamburg, bengaluru: () => dome(16, 12) };

function crop(g: CellGrid, x0: number, y0: number, w: number, h: number) {
  const a = new CellGrid(w, h);
  g.cells.forEach((s, k) => {
    const x = (k % g.w) - x0, y = Math.floor(k / g.w) - y0;
    a.set(x, y, s);
  });
  return a;
}

/** A 36x12 wide scene: the place's landscape sprite in the middle of a low skyline in the field's deep tone. */
function widen(sprite: CellGrid, seed: string) {
  const a = new CellGrid(36, 12);
  const r = rng(hashString(seed + "/wide"));
  let x = 0;
  while (x < 36) {
    const w = 2 + Math.floor(r() * 3);
    const top = 7 + Math.floor(r() * 3);
    a.R(x, top, w, 12 - top, "shade");
    x += w;
  }
  a.X(10, 0, 16, 12);
  a.paste(sprite, 10, 0);
  return a;
}

const cache = new Map<string, CellGrid>();

export function placeGrid(place: string, shape: PlaceShape): CellGrid {
  const id = `${norm(place)}|${shape}`;
  const hit = cache.get(id);
  if (hit) return hit;
  let g: CellGrid;
  const c = cityKey(place);
  const k = countryKey(place);
  if (k === "de" && shape === "wide") g = germanyWide();
  else if (c) g = shape === "wide" ? (c === "berlin" ? germanyWide() : widen(CITY[c](), place)) : CITY[c]();
  else if (k) g = shape === "portrait" ? PORTRAIT[k]() : shape === "landscape" ? LANDSCAPE[k]() : widen(LANDSCAPE[k](), place);
  else {
    const city = genericCity(place);
    g = shape === "wide" ? widen(city, place) : city;
  }
  cache.set(id, g);
  return g;
}

/** A short description of what the art shows, for aria-labels. */
export function placeMotif(place: string): string {
  const c = cityKey(place);
  if (c)
    return {
      berlin: "Berlin TV tower and skyline",
      munich: "Munich twin towers",
      walldorf: "Walldorf office campus",
      frankfurt: "Frankfurt skyline",
      hamburg: "Hamburg harbour cranes",
      bengaluru: "Bengaluru dome and colonnade",
    }[c];
  const k = countryKey(place);
  if (k)
    return {
      de: "Berlin TV tower and Brandenburg Gate",
      us: "New York skyline",
      uk: "Tower Bridge",
      ca: "Rocky mountains",
      nl: "canal gables",
      in: "domed monument",
      other: "globe",
    }[k];
  return `${place} skyline`;
}
