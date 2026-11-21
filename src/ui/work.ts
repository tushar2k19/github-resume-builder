import { describeRepo, formatAgo, formatSize } from '../lib/analyze';
import { languageColor } from '../lib/languages';
import type { RepoLite, ResumeModel } from '../lib/types';

export interface WorkCard {
  repo: RepoLite;
  /** From the model's `summary` for auto-picked work; description or "Language · size" for pins. */
  summary: string;
  reasons: string[];
  color: string;
  pinned: boolean;
}

const CARD_TARGET = 4;

function daysSince(iso: string): number {
  return Math.max(0, (Date.now() - Date.parse(iso)) / 86_400_000);
}

/**
 * Pinned repos (from the URL hash) go first; the model's ranked picks fill the rest up to four.
 * `rest` is every other original repo, for the pin list.
 */
export function composeWork(model: ResumeModel, pins: string[]): { cards: WorkCard[]; rest: RepoLite[] } {
  const byName = new Map(model.repos.map((r) => [r.name, r]));
  const pinnedRepos = pins.map((p) => byName.get(p)).filter((r): r is RepoLite => !!r);
  const pinnedSet = new Set(pinnedRepos.map((r) => r.name));

  const pinnedCards: WorkCard[] = pinnedRepos.map((repo) => {
    const picked = model.selectedWork.find((w) => w.repo.name === repo.name);
    if (picked) {
      return { repo, summary: picked.summary, reasons: ['Pinned', ...picked.reasons], color: picked.languageColor, pinned: true };
    }
    const d = describeRepo(repo, null);
    const reasons = ['Pinned', `Pushed ${formatAgo(daysSince(repo.pushedAt))}`, `${formatSize(repo.sizeKb)} of repository content`];
    return { repo, summary: d.text, reasons, color: languageColor(repo.language), pinned: true };
  });

  const room = Math.max(0, CARD_TARGET - pinnedCards.length);
  const autoCards: WorkCard[] = model.selectedWork
    .filter((w) => !pinnedSet.has(w.repo.name))
    .slice(0, room)
    .map((w) => ({ repo: w.repo, summary: w.summary, reasons: w.reasons, color: w.languageColor, pinned: false }));

  const cards = [...pinnedCards, ...autoCards];
  const shown = new Set(cards.map((c) => c.repo.name));
  const rest = model.repos.filter((r) => !r.isFork && !shown.has(r.name));
  return { cards, rest };
}
