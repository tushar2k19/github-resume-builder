import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ResumeModel } from '../../lib/types';
import { usePrefersReducedMotion } from '../../ui/hooks';
import { composeWork } from '../../ui/work';
import { Identity } from './Identity';
import { LoadRail } from './LoadRail';
import { Method } from './Method';
import { Rhythm } from './Rhythm';
import { SelectedWork } from './SelectedWork';
import { Signals } from './Signals';
import { Stack } from './Stack';

/** The resume itself: charcoal ground, six sections. This is what prints. */
export function Sheet({
  model,
  pins,
  onTogglePin,
}: {
  model: ResumeModel;
  pins: string[];
  onTogglePin: (name: string) => void;
}) {
  const reduce = usePrefersReducedMotion();
  const [showMore, setShowMore] = useState(false);
  const { cards, rest } = useMemo(() => composeWork(model, pins), [model, pins]);
  const loading = model.phase === 'core';

  const selectRepo = useCallback(
    (name: string) => {
      const inCards = cards.some((c) => c.repo.name === name);
      if (!inCards) setShowMore(true);
      const go = (): void => {
        const el = document.getElementById(`repo-${name}`);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        el.classList.remove('flash-target');
        // Restart the highlight animation.
        void el.offsetWidth;
        el.classList.add('flash-target');
        window.setTimeout(() => el.classList.remove('flash-target'), 1500);
      };
      window.setTimeout(go, inCards ? 0 : 120);
    },
    [cards, reduce],
  );

  return (
    <article
      aria-label={`GitHub resume for ${model.profile.name ?? model.profile.login}`}
      className="sheet-ground relative flex flex-col gap-14 text-fg print:gap-8"
    >
      {(loading || model.partial) && (
        <div className="flex flex-col gap-3 print:hidden" data-print="hide">
          {loading && (
            <div className="card p-4">
              <LoadRail stage="enrich" />
            </div>
          )}
          {model.partial && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-frame border border-white/[0.12] bg-card p-4 text-[14px] leading-snug text-fg"
            >
              <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
              <div>
                <strong className="font-medium">Partial sheet.</strong> <span className="text-muted">{model.partial.message}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <Identity model={model} featured={cards} onSelectRepo={selectRepo} />
      <SelectedWork
        cards={cards}
        rest={rest}
        showMore={showMore}
        onShowMore={setShowMore}
        onTogglePin={onTogglePin}
        originals={model.scope.originals}
        pinCount={cards.filter((c) => c.pinned).length}
      />
      <Stack model={model} />
      <Signals model={model} />
      <Rhythm model={model} />
      <Method model={model} />
    </article>
  );
}
