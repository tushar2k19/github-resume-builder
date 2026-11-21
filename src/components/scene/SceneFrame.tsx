import { Component, Suspense, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useInViewport, useMotionOff, usePageVisible, usePrefersReducedMotion, usePrinting, useWebGL } from '../../ui/hooks';
import { cn } from '../../ui/tokens';

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[github-resume] 3D scene failed, showing the still image.', error.message, info.componentStack);
  }
  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface SceneFrameProps {
  /** Accessible name of the scene (role="img"). */
  label: string;
  /** Static SVG: used when WebGL is missing, motion is off, or data is too thin; also for print. */
  still: ReactNode;
  /** Renders the live canvas. `running` is false off-screen, in a hidden tab, or in print. */
  live: (running: boolean) => ReactNode;
  /** Force the still with a reason shown to sighted users. */
  stillReason?: string | null;
  className?: string;
}

/**
 * Chooses between the live WebGL scene and the still SVG. No floating controls: the loop
 * pauses off-screen (IntersectionObserver), in a hidden tab, in print, and whenever motion is
 * off (OS prefers-reduced-motion or the header toggle), which swaps in the still.
 */
export function SceneFrame({ label, still, live, stillReason, className }: SceneFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const userOff = useMotionOff();
  const webgl = useWebGL();
  const printing = usePrinting();
  const inView = useInViewport(ref, '120px');
  const visible = usePageVisible();

  const reason =
    stillReason ??
    (reduced ? (userOff ? 'Motion is off, so this is a still image.' : 'Reduced motion is on, so this is a still image.') : !webgl ? 'WebGL is not available, so this is a still image.' : null);
  const useStill = reason !== null;
  const running = inView && visible && !printing;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div role="img" aria-label={label} className="h-full w-full">
        {useStill ? (
          still
        ) : (
          <>
            <div className="h-full w-full print:hidden" data-print="hide">
              <SceneBoundary fallback={still}>
                <Suspense fallback={still}>{live(running)}</Suspense>
              </SceneBoundary>
            </div>
            <div className="hidden h-full w-full print:block">{still}</div>
          </>
        )}
      </div>
      {useStill && (
        <span className="num pointer-events-none absolute bottom-2 left-3 right-3 text-[10.5px] leading-snug text-muted print:hidden">
          {reason}
        </span>
      )}
    </div>
  );
}
