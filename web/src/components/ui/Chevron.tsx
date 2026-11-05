const PATHS = { right: "M6 3l5 5-5 5", left: "M10 3 5 8l5 5", down: "M3 6l5 5 5-5", up: "M3 10l5-5 5 5" } as const;

/** Square-cap chevron in currentColor (row controls, drill actions). */
export function Chevron({ dir = "right", size = 16, className }: { dir?: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={PATHS[dir]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
