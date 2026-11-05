/** 5x7 cell glyphs for grid-built numerals. "#" is a filled cell. */
const RAW: Record<string, string[]> = {
  "0": ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"],
  "1": ["###..", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "2": ["#####", "....#", "....#", "#####", "#....", "#....", "#####"],
  "3": ["#####", "....#", "....#", ".####", "....#", "....#", "#####"],
  "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  "5": ["#####", "#....", "#....", "#####", "....#", "....#", "#####"],
  "6": ["#####", "#....", "#....", "#####", "#...#", "#...#", "#####"],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": ["#####", "#...#", "#...#", "#####", "#...#", "#...#", "#####"],
  "9": ["#####", "#...#", "#...#", "#####", "....#", "....#", "#####"],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": [".", ".", ".", ".", ".", "#", "#"],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
};

export const GLYPH_ROWS = 7;

export interface GlyphLayout {
  cols: number;
  /** Filled cells as [col, row] in reading order (row by row, left to right). */
  cells: [number, number][];
}

/** Lay out a string of glyphs with a 1-cell gap between them. */
export function layoutGlyphs(text: string): GlyphLayout {
  const glyphs = [...text].map((ch) => RAW[ch]).filter(Boolean);
  const offsets: number[] = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    offsets.push(x);
    x += g[0].length + (i < glyphs.length - 1 ? 1 : 0);
  });
  const cells: [number, number][] = [];
  for (let row = 0; row < GLYPH_ROWS; row++) {
    glyphs.forEach((g, gi) => {
      [...g[row]].forEach((c, col) => {
        if (c === "#") cells.push([offsets[gi] + col, row]);
      });
    });
  }
  return { cols: x, cells };
}
