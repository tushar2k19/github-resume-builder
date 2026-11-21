import type { ResumeModel } from '../../lib/types';
import { RevealItem } from '../../ui/motion';
import { cn } from '../../ui/tokens';
import { ChartFrame } from './ChartFrame';
import { Section } from './Section';

const LEVEL_MARK: Record<string, string> = { info: 'ok', warn: 'warn', error: 'fail' };

/** Visible footer: what was fetched, the event window, what was estimated, requests left. Monospace rows on a 1px green rail. */
export function Method({ model }: { model: ResumeModel }) {
  const { facts } = model;
  const when = new Date(model.generatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Section id="method" kicker="Method" title="How this sheet was built">
      <RevealItem>
        <ChartFrame
          chip="Build log"
          title="What was fetched, and what was estimated"
          meta={`generated ${when}`}
          summary={`Build log: ${facts.lines.join(' ')}`}
          footer={
            <details className="rounded-plot border border-white/[0.08] bg-ground px-3 py-2 print:hidden" data-print="hide">
              <summary className="min-h-[28px] cursor-pointer text-[13px] font-medium text-fg">
                Full request log ({model.log.length} steps)
              </summary>
              <ol className="num m-0 mt-2 list-none space-y-1 border-l border-glow/60 p-0 pl-3 text-[11.5px] text-muted">
                {model.log.map((entry, i) => (
                  <li key={i} className={cn('flex gap-2', entry.level === 'error' && 'text-fg', entry.level === 'warn' && 'text-fg/80')}>
                    <span className="w-14 shrink-0 text-right">{entry.elapsedMs} ms</span>
                    <span className="w-10 shrink-0 uppercase">{LEVEL_MARK[entry.level] ?? entry.level}</span>
                    <span className="w-16 shrink-0">{entry.step}</span>
                    <span className="min-w-0 break-words">{entry.message}</span>
                  </li>
                ))}
              </ol>
            </details>
          }
        >
          <ul className="num m-0 list-none space-y-2 border-l border-glow/60 p-0 pl-4 text-[12.5px] leading-relaxed text-fg/90">
            {facts.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            {facts.estimates.map((line, i) => (
              <li key={`e${i}`} className="text-muted">
                Estimated: {line}
              </li>
            ))}
          </ul>
        </ChartFrame>
      </RevealItem>
    </Section>
  );
}
