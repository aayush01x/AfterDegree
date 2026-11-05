/** The one permitted diagonal: lives inside primary buttons and the active nav item. */
export function Slash({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M1.5 14.5 14.5 1.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" />
    </svg>
  );
}
