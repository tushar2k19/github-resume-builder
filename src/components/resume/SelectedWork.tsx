import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, GitFork, Pin, PinOff, Star } from 'lucide-react';
import { describeRepo, formatAgo, formatSize } from '../../lib/analyze';
import { languageColor } from '../../lib/languages';
import type { RepoLite } from '../../lib/types';
import { RevealItem } from '../../ui/motion';
import { cn, muteLang, withAlpha } from '../../ui/tokens';
import type { WorkCard } from '../../ui/work';
import { Section } from './Section';

function ago(iso: string): string {
  return formatAgo(Math.max(0, (Date.now() - Date.parse(iso)) / 86_400_000));
}

function PinButton({ pinned, name, onToggle }: { pinned: boolean; name: string; onToggle: (name: string) => void }) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name} to selected work`}
      title={pinned ? 'Unpin' : 'Pin to selected work (saved in the link)'}
      onClick={() => onToggle(name)}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-transparent transition-colors hover:text-fg print:hidden',
        pinned ? 'border-glow/60 text-fg' : 'border-white/[0.12] text-muted hover:border-white/30',
      )}
      data-print="hide"
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

/** A dark row with a 2px language edge that brightens on hover. */
function WorkRow({ card, onToggle }: { card: WorkCard; onToggle: (name: string) => void }) {
  const { repo } = card;
  const mark = muteLang(card.color);
  const reasons = card.reasons.filter((r) => r !== 'Pinned').slice(0, 3);
  return (
    <article
      id={`repo-${repo.name}`}
      className="group relative min-w-0 scroll-mt-24 overflow-hidden rounded-plot bg-ground/60 transition-colors hover:bg-ground"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-[2px] opacity-70 transition-[opacity,box-shadow] group-hover:opacity-100"
        style={{ background: mark, boxShadow: `0 0 10px ${withAlpha(mark, 0.35)}` }}
      />
      <div className="flex flex-col gap-2 py-4 pl-5 pr-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 break-all text-[1.05rem] font-medium leading-tight text-fg no-underline hover:underline"
            >
              {repo.name}
              <ExternalLink size={13} aria-hidden="true" className="shrink-0 text-muted" />
            </a>
            <div className="num mt-1 flex items-center gap-2 text-[11.5px] text-muted">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: mark }} />
              {repo.language ?? 'No primary language'}
              {card.pinned && <span className="uppercase tracking-wide text-fg/70">· pinned</span>}
            </div>
          </div>
          <PinButton pinned={card.pinned} name={repo.name} onToggle={onToggle} />
        </div>
        <p className="m-0 max-w-[78ch] text-[14px] leading-relaxed text-fg/90">{card.summary}</p>
        {reasons.length > 0 && <p className="num m-0 text-[11.5px] leading-relaxed text-muted">{reasons.join(' · ')}</p>}
        <dl className="num m-0 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Stars</dt>
            <Star size={12} aria-hidden="true" />
            <dd className="m-0">{repo.stars}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Forks</dt>
            <GitFork size={12} aria-hidden="true" />
            <dd className="m-0">{repo.forks}</dd>
          </div>
          <div>
            <dt className="sr-only">Size</dt>
            <dd className="m-0">{formatSize(repo.sizeKb)}</dd>
          </div>
          <div>
            <dt className="sr-only">Last push</dt>
            <dd className="m-0">pushed {ago(repo.pushedAt)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function Row({ repo, onToggle }: { repo: RepoLite; onToggle: (name: string) => void }) {
  const desc = describeRepo(repo, null);
  const mark = muteLang(languageColor(repo.language));
  return (
    <li
      id={`repo-${repo.name}`}
      className="group relative flex scroll-mt-24 items-center gap-3 overflow-hidden rounded-plot bg-ground/60 py-2 pl-5 pr-3 hover:bg-ground"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-[2px] opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: mark }}
      />
      <div className="min-w-0 flex-1">
        <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="text-[14px] font-medium text-fg no-underline hover:underline">
          {repo.name}
        </a>
        <p className="m-0 truncate text-[12.5px] text-muted">{desc.text}</p>
      </div>
      <span className="num hidden shrink-0 text-[11.5px] text-muted sm:inline">
        {formatSize(repo.sizeKb)} · {ago(repo.pushedAt)}
      </span>
      <PinButton pinned={false} name={repo.name} onToggle={onToggle} />
    </li>
  );
}

export function SelectedWork({
  cards,
  rest,
  showMore,
  onShowMore,
  onTogglePin,
  originals,
  pinCount,
}: {
  cards: WorkCard[];
  rest: RepoLite[];
  showMore: boolean;
  onShowMore: (open: boolean) => void;
  onTogglePin: (name: string) => void;
  originals: number;
  pinCount: number;
}) {
  return (
    <Section
      id="work"
      kicker="Selected work"
      title={cards.length > 0 ? `${cards.length} ${cards.length === 1 ? 'project' : 'projects'} worth opening first` : 'Selected work'}
      lead="Ranked by how recently it moved, how much is in it, whether a stranger can read it, and community response. Forks and archived repositories are not featured."
    >
      <RevealItem>
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="num text-[11px] uppercase tracking-[0.12em] text-muted">Featured</span>
            <span className="num text-[11px] text-muted">
              {pinCount > 0 ? `${pinCount} pinned · ` : ''}from {originals} original {originals === 1 ? 'project' : 'projects'}
            </span>
          </div>
          {cards.length === 0 ? (
            <p className="m-0 border-t border-white/[0.08] pt-3 text-sm text-muted" role="status">
              No original project with content to feature yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {cards.map((c) => (
                <WorkRow key={c.repo.name} card={c} onToggle={onTogglePin} />
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-4 print:hidden" data-print="hide">
              <button
                type="button"
                aria-expanded={showMore}
                aria-controls="more-projects"
                onClick={() => onShowMore(!showMore)}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-white/[0.12] bg-transparent px-4 text-[13px] font-medium text-fg transition-colors hover:border-glow/60"
              >
                {showMore ? 'Hide other projects' : `${rest.length} other original ${rest.length === 1 ? 'project' : 'projects'}: pin any to feature it`}
                <ChevronDown size={15} aria-hidden="true" className={cn('transition-transform', showMore && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {showMore && (
                  <motion.ul
                    id="more-projects"
                    className="m-0 mt-3 grid list-none gap-2 p-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {rest.map((r) => (
                      <Row key={r.name} repo={r} onToggle={onTogglePin} />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </RevealItem>
    </Section>
  );
}
