/** Three by three cells, two left open: a cohort with gaps in what we can see. */
export function BrandMark({ size = 22 }: { size?: number }) {
  const cells: [number, number, boolean][] = [
    [0, 0, true], [1, 0, true], [2, 0, true],
    [0, 1, true], [1, 1, false], [2, 1, true],
    [0, 2, false], [1, 2, true], [2, 2, true],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      {cells.map(([x, y, filled]) =>
        filled ? (
          <rect key={`${x}${y}`} x={x * 8} y={y * 8} width="6" height="6" fill="var(--ad-orange)" />
        ) : (
          <rect key={`${x}${y}`} x={x * 8 + 0.5} y={y * 8 + 0.5} width="5" height="5" fill="none" stroke="var(--ad-paper)" />
        ),
      )}
    </svg>
  );
}
