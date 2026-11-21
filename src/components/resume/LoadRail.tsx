import { Check } from 'lucide-react';
import { cn } from '../../ui/tokens';

export type LoadStage = 'core' | 'enrich' | 'done';

const STEPS: Array<{ key: string; active: string; done: string }> = [
  { key: 'core', active: 'Reading profile, repositories and public events…', done: 'Profile, repositories and events read' },
  { key: 'lang', active: 'Weighing languages by volume…', done: 'Language bytes weighed' },
  { key: 'readme', active: 'Reading READMEs for featured work…', done: 'READMEs read' },
];

/**
 * Narrated progress rail. The stages mirror the real fetch order of loadResume:
 * (1) user + repos + events in parallel, then (2) languages and READMEs.
 */
export function LoadRail({ stage }: { stage: LoadStage }) {
  const idx = stage === 'core' ? 0 : stage === 'enrich' ? 1 : 3;
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite" aria-label="Loading progress">
      {STEPS.map((s, i) => {
        const done = i < idx;
        // After the core call, languages and READMEs run together.
        const current = stage === 'enrich' ? i >= 1 : i === idx;
        const show = stage === 'done' || i <= Math.max(idx, stage === 'enrich' ? 2 : 0);
        if (!show) return null;
        return (
          <li key={s.key} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                done ? 'border-glow text-glow' : current ? 'shimmer border-glow/60' : 'border-white/20',
              )}
            >
              {done && <Check size={10} strokeWidth={3} />}
            </span>
            <span className={done ? 'text-muted' : 'text-fg'}>{done ? s.done : s.active}</span>
          </li>
        );
      })}
    </ol>
  );
}
