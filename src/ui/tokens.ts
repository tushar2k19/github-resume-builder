/**
 * Dark GitHub resume: warm charcoal ground, one quiet green line.
 * Language hue appears only as a 6px dot, a 2px edge, or a thin stroke, with chroma reduced.
 */

export const GROUND = '#0C0B0A';
export const LIFT = '#141210';
export const CARD = '#141311';
export const TEXT = '#F3F0EA';
export const MUTED = '#8A847C';
export const HAIR = 'rgba(255,248,240,0.08)';
export const GRID = 'rgba(255,248,240,0.06)';
export const GREEN = '#3DDC84';
export const GREEN_DIM = '#1E6B40';
export const WARM_GRAY = '#7A746C';
export const OTHER_LABEL = 'other';

/** Heatmap ramp: charcoal to a dim green (index 0 = no events). */
export const GREEN_RAMP = ['#17150F', '#143222', '#1A4A2F', '#24683C', '#34B96E'];

/** Event-mix ribbon: two steps only (green and warm gray). */
export const MIX_STEPS = [GREEN, WARM_GRAY];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/**
 * Linguist hue with the chroma pulled down and lightness held in a narrow band,
 * so neighbouring languages never read as a rainbow on charcoal.
 */
export function muteLang(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const sat = Math.min(0.42, s * 0.5);
  const lig = Math.max(0.5, Math.min(0.66, l * 0.35 + 0.34));
  return rgbToHex(...hslToRgb(h, sat, lig));
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
