import { CellArt } from "./CellArt";
import { placeColors, placeGrid, placeMotif, type PlaceShape } from "./places";

export interface PlaceArtProps {
  place: string;
  shape?: PlaceShape;
  pitch?: number;
  label?: string;
  /** Override the field (a token expression). */
  field?: string;
  className?: string;
}

/** City / country art built from cells. Unknown places get a generic skyline in a stable hue. */
export function PlaceArt({ place, shape = "portrait", pitch = 8, label, field, className }: PlaceArtProps) {
  const colors = placeColors(place);
  return (
    <CellArt
      grid={placeGrid(place, shape)}
      field={field ?? colors.field}
      on={colors.on}
      pitch={pitch}
      align="bottom"
      label={label ?? `${placeMotif(place)}, built from cells`}
      className={className}
    />
  );
}

/** The field token for a place, e.g. "var(--art-de)". */
export function placeField(place: string): string {
  return placeColors(place).field;
}

export { placeColors };
