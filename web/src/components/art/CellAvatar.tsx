import { CellArt } from "./CellArt";
import { CellGrid, hashString, rng, type Slot } from "./grid";

export interface CellAvatarProps {
  seed: string;
  /** Cells per side. */
  cells?: number;
  /** Cell pitch in px. */
  cell?: number;
  inverse?: boolean;
  className?: string;
}

/** A neutral, symmetric cell weave standing in for a person. Decorative: never a face, never initials. */
export function CellAvatar({ seed, cells = 4, cell = 8, inverse = false, className }: CellAvatarProps) {
  const a = new CellGrid(cells, cells);
  const r = rng(hashString(seed));
  const pal: Slot[] = ["sil", "tint", "glow"];
  const half = Math.ceil(cells / 2);
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < half; x++) {
      const s = pal[Math.floor(r() * 3)];
      a.set(x, y, s).set(cells - 1 - x, y, s);
    }
  return (
    <CellArt
      grid={a}
      field={inverse ? "var(--ad-ink)" : "var(--ad-paper)"}
      on={inverse ? "var(--ad-paper)" : "var(--ad-ink)"}
      pitch={cell}
      gap={1}
      fit="inline"
      className={className}
    />
  );
}
