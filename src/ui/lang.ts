import type { LanguageEntry } from '../lib/types';
import { OTHER_LABEL, WARM_GRAY, muteLang } from './tokens';

const MAX_HUES = 5;

export interface Mark extends LanguageEntry {
  /** Muted display color (dot, edge, stroke). */
  mark: string;
  isOther: boolean;
}

/**
 * At most five muted hues. Everything past that, plus the model's own "Other", is
 * folded into one warm gray entry labelled "other".
 */
export function groupLanguages(entries: LanguageEntry[]): Mark[] {
  const named = entries.filter((e) => e.name !== 'Other');
  const head = named.slice(0, MAX_HUES);
  const tail = [...named.slice(MAX_HUES), ...entries.filter((e) => e.name === 'Other')];
  const out: Mark[] = head.map((e) => ({ ...e, mark: muteLang(e.color), isOther: false }));
  if (tail.length > 0) {
    const bytes = tail.reduce((s, e) => s + e.bytes, 0);
    const measuredBytes = tail.reduce((s, e) => s + e.measuredBytes, 0);
    const estimatedBytes = tail.reduce((s, e) => s + e.estimatedBytes, 0);
    const share = tail.reduce((s, e) => s + e.share, 0);
    out.push({
      name: OTHER_LABEL,
      color: WARM_GRAY,
      mark: WARM_GRAY,
      bytes,
      measuredBytes,
      estimatedBytes,
      share,
      estimated: estimatedBytes > 0,
      isOther: true,
    });
  }
  return out;
}
