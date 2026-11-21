import { createContext, useCallback, useContext, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../ui/tokens';

type SetTip = (text: string | null) => void;
const TipContext = createContext<SetTip>(() => {});

/**
 * Props to spread on any mark (HTML or SVG element) so its detail shows in the
 * frame's tooltip on hover AND on keyboard focus.
 */
export function useTipProps(tip: string): {
  tabIndex: 0;
  'aria-label': string;
  onFocus: () => void;
  onBlur: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
} {
  const set = useContext(TipContext);
  return {
    tabIndex: 0,
    'aria-label': tip,
    onFocus: () => set(tip),
    onBlur: () => set(null),
    onMouseEnter: () => set(tip),
    onMouseLeave: () => set(null),
  };
}

export function useSetTip(): SetTip {
  return useContext(TipContext);
}

/** Wrapper element that carries tip behaviour (for marks that are plain divs). */
export function TipMark({
  tip,
  className,
  style,
  children,
}: {
  tip: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const props = useTipProps(tip);
  return (
    <div {...props} role="img" className={className} style={style}>
      {children}
    </div>
  );
}

export interface ChartFrameProps {
  /** Small mono caption above the heading. */
  chip: string;
  /** Visible heading under the caption. */
  title?: string;
  /** Corner meta, e.g. the window or "by bytes". */
  meta?: ReactNode;
  /** One-sentence summary for assistive tech. */
  summary: string;
  /** When set, the plot is replaced by one muted sentence. */
  empty?: string | null;
  /** Designed legend, below the plot. */
  legend?: ReactNode;
  /** Shown in the tooltip strip when nothing is hovered/focused. Omit to hide the strip. */
  tipHint?: string;
  /** Extra content below the plot (e.g. "How?" disclosure). */
  footer?: ReactNode;
  className?: string;
  plotClassName?: string;
  children?: ReactNode;
  id?: string;
}

/**
 * Shared frame for every graphic: a charcoal card with a hairline edge, a mono caption,
 * corner meta, legend, keyboard-reachable tooltip strip, summary for AT, and one-sentence empty state.
 */
export function ChartFrame({
  chip,
  title,
  meta,
  summary,
  empty,
  legend,
  tipHint,
  footer,
  className,
  plotClassName,
  children,
  id,
}: ChartFrameProps) {
  const uid = useId();
  const [tip, setTipState] = useState<string | null>(null);
  const setTip = useCallback<SetTip>((text) => setTipState(text), []);
  const ctx = useMemo(() => setTip, [setTip]);

  return (
    <TipContext.Provider value={ctx}>
      <figure
        id={id}
        className={cn('card m-0 flex min-w-0 flex-col gap-3 p-5 text-fg', className)}
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-summary`}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="num text-[11px] uppercase tracking-[0.12em] text-muted">{chip}</span>
          {meta && <span className="num text-[11px] text-muted">{meta}</span>}
        </header>
        <h3 id={`${uid}-title`} className={cn('m-0 text-[1.05rem] font-medium leading-snug text-fg', !title && 'sr-only')}>
          {title ?? chip}
        </h3>
        <p id={`${uid}-summary`} className="sr-only">
          {summary}
        </p>

        <div className={cn('relative min-w-0 py-1', plotClassName)}>
          {empty ? (
            <p className="m-0 border-t border-white/[0.08] pt-3 text-sm text-muted" role="status">
              {empty}
            </p>
          ) : (
            children
          )}
        </div>

        {tipHint !== undefined && !empty && (
          <p
            className="num m-0 min-h-[2.4em] rounded-plot border border-white/[0.08] bg-ground px-3 py-1.5 text-[12px] leading-snug"
            style={{ color: tip ? '#F3F0EA' : '#8A847C' }}
            role="status"
            aria-live="polite"
          >
            {tip ?? tipHint}
          </p>
        )}
        {legend && !empty && <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">{legend}</div>}
        {footer}
      </figure>
    </TipContext.Provider>
  );
}

export function LegendSwatch({
  color,
  label,
  hatched,
}: {
  color: string;
  label: string;
  hatched?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn('inline-block h-1.5 w-1.5 rounded-full', hatched && 'hatch')}
        style={{ background: color }}
      />
      <span>{label}</span>
    </span>
  );
}
