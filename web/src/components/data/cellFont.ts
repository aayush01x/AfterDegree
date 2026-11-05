/**
 * Cell fonts for grid-built numerals (from the approved mockups).
 * "#" is a filled cell. 5x7 for headline and tile counts, 3x5 for small inline counts.
 * Every stroke is orthogonal: the only diagonal in the app is the Slash mark.
 */
export type CellFontName = "5x7" | "3x5";

const F57: Record<string, string[]> = {
  "0": ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"],
  "1": ["###..", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "2": ["#####", "....#", "....#", "#####", "#....", "#....", "#####"],
  "3": ["#####", "....#", "....#", ".####", "....#", "....#", "#####"],
  "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  "5": ["#####", "#....", "#....", "#####", "....#", "....#", "#####"],
  "6": ["#####", "#....", "#....", "#####", "#...#", "#...#", "#####"],
  "7": ["#####", "....#", "....#", "....#", "....#", "....#", "....#"],
  "8": ["#####", "#...#", "#...#", "#####", "#...#", "#...#", "#####"],
  "9": ["#####", "#...#", "#...#", "#####", "....#", "....#", "#####"],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": [".", ".", ".", ".", ".", "#", "#"],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "+": [".....", ".....", "..#..", "#####", "..#..", ".....", "....."],
  "%": ["##..#", "##..#", "....#", "#####", "#....", "#..##", "#..##"],
  "~": [".....", ".....", "##...", "#.#.#", "...##", ".....", "....."],
};

const F35: Record<string, string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": ["##.", ".#.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", "..#", "..#"],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ".": [".", ".", ".", ".", "#"],
  ",": [".", ".", ".", "#", "#"],
  "-": ["...", "...", "###", "...", "..."],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "~": ["...", "##.", "#.#", ".##", "..."],
};

const FONTS: Record<CellFontName, Record<string, string[]>> = { "5x7": F57, "3x5": F35 };

export interface CellLayout {
  cols: number;
  rows: number;
  /** Filled cells as [col, row] in reading order (row by row, left to right). */
  cells: [number, number][];
}

/** Lay out a string with a 1-cell gap between glyphs. Unknown characters are skipped. */
export function layoutCells(text: string, font: CellFontName = "5x7"): CellLayout {
  const f = FONTS[font];
  const rows = font === "5x7" ? 7 : 5;
  const glyphs = [...text].map((ch) => f[ch]).filter(Boolean);
  const offsets: number[] = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    offsets.push(x);
    x += g[0].length + (i < glyphs.length - 1 ? 1 : 0);
  });
  const cells: [number, number][] = [];
  for (let row = 0; row < rows; row++) {
    glyphs.forEach((g, gi) => {
      [...g[row]].forEach((c, col) => {
        if (c === "#") cells.push([offsets[gi] + col, row]);
      });
    });
  }
  return { cols: x, rows, cells };
}

/** Integers as-is, other finite numbers with one decimal. */
export function numberText(value: number | string): string {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
