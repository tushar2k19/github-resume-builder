import { setMotionOff, useMotionOff, usePrefersReducedMotion } from '../ui/hooks';

/** One quiet text toggle. The OS prefers-reduced-motion setting also stops motion. */
export function MotionToggle({ className }: { className?: string }) {
  const off = useMotionOff();
  const reduced = usePrefersReducedMotion();
  const label = reduced && !off ? 'Motion: off (system)' : off ? 'Motion: off' : 'Motion: on';
  return (
    <button
      type="button"
      aria-pressed={off}
      disabled={reduced && !off}
      onClick={() => setMotionOff(!off)}
      className={`num min-h-[32px] border-0 bg-transparent p-0 text-[11.5px] tracking-wide text-muted transition-colors hover:text-fg disabled:cursor-default disabled:hover:text-muted print:hidden ${className ?? ''}`}
      data-print="hide"
    >
      {label}
    </button>
  );
}
