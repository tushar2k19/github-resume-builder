import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { animate, motion, useInView, type Variants } from 'framer-motion';
import { usePrefersReducedMotion, usePrinting } from './hooks';
import { GREEN } from './tokens';

const EASE = [0.22, 1, 0.36, 1] as const;

const groupVariants: Variants = {
  hide: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hide: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.48, ease: EASE } },
};

/** Reveals its RevealItem descendants in view, ~55ms apart, each under 600ms. */
export function RevealGroup({
  children,
  className,
  as = 'div',
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul';
  id?: string;
}) {
  const reduce = usePrefersReducedMotion();
  const Comp = motion[as] as ElementType;
  return (
    <Comp
      id={id}
      className={className}
      variants={groupVariants}
      initial={reduce ? false : 'hide'}
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
    >
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'header' | 'p';
}) {
  const Comp = motion[as] as ElementType;
  return (
    <Comp data-reveal className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}

/** Number that counts up once in view. Final value shows under reduced motion and print. */
export function CountUp({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();
  const printing = usePrinting();
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const fmt = (n: number): string =>
    n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const [text, setText] = useState(() => (reduce ? fmt(value) : fmt(0)));

  useEffect(() => {
    if (reduce || printing) {
      setText(fmt(value));
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (n) => setText(fmt(n)),
      onComplete: () => setText(fmt(value)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce, printing, decimals]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/** Dial: a hairline track and a thin green arc. The arc draws once in view; reduced motion and print draw it at once. */
export function Ring({
  fraction,
  size = 84,
  stroke = 2,
  color = GREEN,
  track = 'rgba(255,248,240,0.08)',
  children,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const printing = usePrinting();
  const reduce = reducedMotion || printing;
  const f = Math.max(0, Math.min(1, fraction));
  const r = (size - stroke) / 2 - 1;
  const c = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {f > 0 && (
          <motion.circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: f }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ pathLength: reduce ? f : undefined }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  );
}

export { EASE };
