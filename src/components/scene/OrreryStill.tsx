import { useId } from 'react';
import { RING_RADII, SQUASH, type OrreryLayout } from './layout';

const VB = 100;
const SCALE = 11.2; // scene unit -> viewBox unit
const C = VB / 2;
const RING_STROKE = 'rgba(243,240,234,0.16)';

/**
 * Frozen SVG of the orrery: same rings, same bodies, same layout as the WebGL scene.
 * Used for reduced motion, print, and when WebGL is missing.
 */
export function OrreryStill({
  layout,
  activeName,
  onHover,
  onSelect,
  className,
}: {
  layout: OrreryLayout;
  activeName?: string | null;
  onHover?: (name: string | null) => void;
  onSelect?: (name: string) => void;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const { center, bodies } = layout;
  const interactive = !!onSelect;
  return (
    <svg
      viewBox={`0 0 ${VB} ${VB * 0.66}`}
      className={className ?? 'block h-full w-full'}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" stopColor="#F3F0EA" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#F3F0EA" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#F3F0EA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={center.color} stopOpacity="0.55" />
          <stop offset="78%" stopColor={center.color} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#DDEFE3" stopOpacity="0.95" />
        </radialGradient>
      </defs>
      <g transform={`translate(${C} ${(VB * 0.66) / 2})`}>
        {RING_RADII.map((r) => (
          <ellipse
            key={r}
            cx={0}
            cy={0}
            rx={r * SCALE}
            ry={r * SCALE * SQUASH}
            fill="none"
            stroke={RING_STROKE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle r={center.radius * SCALE * 2.4} fill={`url(#${uid}-halo)`} />
        <circle r={center.radius * SCALE} fill={`url(#${uid}-core)`} />
        {bodies.map((b) => {
          const x = Math.cos(b.angle) * b.orbit * SCALE;
          const y = Math.sin(b.angle) * b.orbit * SCALE * SQUASH;
          const active = activeName === b.name;
          const r = b.radius * SCALE * (active ? 1.25 : 1);
          return (
            <g
              key={b.name}
              style={interactive ? { cursor: 'pointer' } : undefined}
              onMouseEnter={onHover ? () => onHover(b.name) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
              onClick={onSelect ? () => onSelect(b.name) : undefined}
            >
              <circle cx={x} cy={y} r={r * 2.4} fill={b.color} opacity={active ? 0.16 : 0.07} />
              <circle cx={x} cy={y} r={r} fill={b.color} />
              <circle cx={x} cy={y} r={r} fill="none" stroke="#F3F0EA" strokeOpacity={active ? 0.7 : 0.25} strokeWidth={0.4} />
              {interactive && <title>{b.name}</title>}
              {interactive && <circle cx={x} cy={y} r={Math.max(r * 2, 4)} fill="transparent" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
