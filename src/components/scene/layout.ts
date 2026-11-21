import type { LanguageEntry } from '../../lib/types';
import { muteLang } from '../../ui/tokens';
import type { WorkCard } from '../../ui/work';

/** Ring radii in scene units. Three or four thin rings, nothing else in the field. */
export const RING_RADII = [1.6, 2.3, 3.0, 3.7];
/** The plane is tilted so rings read as thin ellipses. cos(TILT) is the vertical squash. */
export const TILT = 1.0;
export const SQUASH = Math.cos(TILT);
/** One revolution of the whole orrery, in seconds (drift, inside the 90-180 s range). */
export const REVOLUTION_S = 140;
export const MAX_BODIES = 6;
/** The still SVG and the WebGL view share this half-extent. */
export const EXTENT = 4.1;

export interface OrreryCenter {
  name: string;
  color: string;
  /** Sphere radius in scene units, from the language's byte share. */
  radius: number;
  share: number;
}

export interface OrreryBody {
  name: string;
  language: string | null;
  color: string;
  radius: number;
  orbit: number;
  /** Radians, from creation order. */
  angle: number;
  sizeKb: number;
  pushedAt: string;
}

export interface OrreryLayout {
  center: OrreryCenter;
  bodies: OrreryBody[];
}

export function orreryLayout(dominant: LanguageEntry | null, featured: WorkCard[]): OrreryLayout {
  const share = dominant ? Math.max(0, Math.min(1, dominant.share)) : 0.3;
  const center: OrreryCenter = {
    name: dominant?.name ?? 'No dominant language',
    color: dominant ? muteLang(dominant.color) : '#8A847C',
    radius: 0.34 + Math.sqrt(share) * 0.4,
    share,
  };

  const cards = featured.slice(0, MAX_BODIES);
  const n = cards.length;
  if (n === 0) return { center, bodies: [] };

  // Size: log of repo size, normalised across the featured set.
  const logs = cards.map((c) => Math.log1p(Math.max(0, c.repo.sizeKb)));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const span = Math.max(1e-6, hi - lo);

  // Orbit: recency, newest inward. Angle: creation order.
  const byPush = [...cards].sort((a, b) => Date.parse(b.repo.pushedAt) - Date.parse(a.repo.pushedAt));
  const byCreated = [...cards].sort((a, b) => Date.parse(a.repo.createdAt) - Date.parse(b.repo.createdAt));
  const maxRing = RING_RADII.length - 1;

  const bodies = cards.map((c, i) => {
    const rank = byPush.indexOf(c);
    const k = byCreated.indexOf(c);
    const ring = n === 1 ? 0 : Math.round((rank / (n - 1)) * maxRing);
    return {
      name: c.repo.name,
      language: c.repo.language,
      color: muteLang(c.color),
      radius: 0.1 + (n === 1 ? 0.5 : (logs[i]! - lo) / span) * 0.12,
      orbit: RING_RADII[ring]!,
      angle: -Math.PI / 2 + 0.7 + (k / n) * Math.PI * 2,
      sizeKb: c.repo.sizeKb,
      pushedAt: c.repo.pushedAt,
    };
  });
  return { center, bodies };
}

/** Landing-stage preview: no data, no hue. Warm grays on charcoal. */
export const PREVIEW_LAYOUT: OrreryLayout = {
  center: { name: 'preview', color: '#8F8A82', radius: 0.62, share: 0.5 },
  bodies: [
    { name: 'a', language: null, color: '#8A847C', radius: 0.17, orbit: RING_RADII[0]!, angle: -0.6, sizeKb: 1, pushedAt: '' },
    { name: 'b', language: null, color: '#7F8C84', radius: 0.12, orbit: RING_RADII[1]!, angle: 2.1, sizeKb: 1, pushedAt: '' },
    { name: 'c', language: null, color: '#8A847C', radius: 0.2, orbit: RING_RADII[2]!, angle: 0.9, sizeKb: 1, pushedAt: '' },
    { name: 'd', language: null, color: '#7A746C', radius: 0.1, orbit: RING_RADII[3]!, angle: 3.9, sizeKb: 1, pushedAt: '' },
  ],
};
