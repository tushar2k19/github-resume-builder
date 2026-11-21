import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatSize } from '../../lib/analyze';
import type { LanguageShare, ResumeModel } from '../../lib/types';
import { EASE, RevealItem } from '../../ui/motion';
import { usePrefersReducedMotion, usePrinting } from '../../ui/hooks';
import { groupLanguages, type Mark } from '../../ui/lang';
import { mix } from '../../ui/tokens';
import { ChartFrame, LegendSwatch, useTipProps } from './ChartFrame';
import { Section } from './Section';

function pct(share: number): string {
  if (share >= 0.1) return `${Math.round(share * 100)}%`;
  const v = Math.round(share * 1000) / 10;
  return `${v}%`;
}

function detailOf(entry: Mark): string {
  return `${entry.name} · ${pct(entry.share)} of bytes · ${formatSize(entry.bytes / 1024)}${
    entry.estimatedBytes > 0
      ? entry.measuredBytes > 0
        ? ` (${formatSize(entry.estimatedBytes / 1024)} estimated from repo size)`
        : ' (estimated from repo size)'
      : ' (measured)'
  }`;
}

function Segment({
  entry,
  dim,
  onHover,
}: {
  entry: Mark;
  dim: boolean;
  onHover: (name: string | null) => void;
}) {
  const estimatedFraction = entry.bytes > 0 ? entry.estimatedBytes / entry.bytes : 0;
  const tip = useTipProps(detailOf(entry));
  return (
    <div
      {...tip}
      role="img"
      onMouseEnter={() => {
        tip.onMouseEnter();
        onHover(entry.name);
      }}
      onMouseLeave={() => {
        tip.onMouseLeave();
        onHover(null);
      }}
      onFocus={() => {
        tip.onFocus();
        onHover(entry.name);
      }}
      onBlur={() => {
        tip.onBlur();
        onHover(null);
      }}
      className="flex h-5 min-w-[4px] items-center transition-opacity duration-200"
      style={{ flex: `${entry.share} 1 0`, opacity: dim ? 0.3 : 1 }}
    >
      <div
        className="relative h-[10px] w-full overflow-hidden"
        style={{
          borderRadius: 3,
          background: `linear-gradient(90deg, ${mix(entry.mark, '#0C0B0A', 0.28)}, ${entry.mark})`,
        }}
      >
        {estimatedFraction > 0 && (
          <span
            aria-hidden="true"
            className="hatch-light absolute bottom-0 right-0 top-0"
            style={{ width: `${Math.min(100, estimatedFraction * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function RibbonRow({ label, sub, share }: { label: string; sub: string; share: LanguageShare }) {
  const reduce = usePrefersReducedMotion();
  const printing = usePrinting();
  const still = reduce || printing;
  const [hover, setHover] = useState<string | null>(null);
  const marks = useMemo(() => groupLanguages(share.entries), [share.entries]);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[13px] font-medium text-fg">{label}</span>
        <span className="num text-[11.5px] text-muted">{sub}</span>
      </div>
      <motion.div
        className="flex gap-[3px]"
        style={{ transformOrigin: 'left center' }}
        initial={still ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {marks.map((e) => (
          <Segment key={e.name} entry={e} dim={hover !== null && hover !== e.name} onHover={setHover} />
        ))}
      </motion.div>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px]">
        {marks.map((e) => (
          <li
            key={e.name}
            className="inline-flex items-center gap-1.5 text-fg transition-opacity"
            style={{ opacity: hover !== null && hover !== e.name ? 0.4 : 1 }}
            onMouseEnter={() => setHover(e.name)}
            onMouseLeave={() => setHover(null)}
          >
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: e.mark }} />
            {e.name}
            <span className="num text-muted">
              {pct(e.share)}
              {e.estimated ? ' est.' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Stack({ model }: { model: ResumeModel }) {
  const { stack } = model;
  const noData = stack.all.entries.length === 0 || stack.all.totalBytes === 0;
  const recentRow = stack.enough ? (
    <RibbonRow
      label={`Pushed in the last ${stack.windowDays} days`}
      sub={`${stack.recentRepoCount} ${stack.recentRepoCount === 1 ? 'repo' : 'repos'}`}
      share={stack.recent}
    />
  ) : (
    <div>
      <div className="mb-1 text-[13px] font-medium text-fg">Pushed in the last {stack.windowDays} days</div>
      <p className="m-0 border-t border-white/[0.08] pt-2 text-[12.5px] text-muted">
        No original project pushed in this window.
      </p>
    </div>
  );

  const lead = stack.all.entries.find((e) => e.name !== 'Other');
  const summary = noData
    ? 'Language mix is not available.'
    : `Languages by bytes across ${stack.allRepoCount} original projects${lead ? `, led by ${lead.name} at ${pct(lead.share)}` : ''}${
        stack.leaderChanged ? `; recent work leads with ${stack.leaderRecent}` : ''
      }.`;

  return (
    <Section
      id="stack"
      kicker="Stack"
      title="Languages by volume, then and now"
      lead="Measured bytes from GitHub where available. Hatched slices are estimated from repository size and primary language. Past five languages, the tail is folded into one gray “other”."
    >
      <RevealItem className="min-w-0">
        <ChartFrame
          chip="Language ribbon"
          title="All time against the last six months"
          meta={model.phase === 'core' ? 'refining with measured bytes…' : 'by bytes'}
          summary={summary}
          empty={noData ? 'Not enough public data: no original repository reports a language.' : null}
          tipHint="Hover or focus a segment for bytes and whether they are measured."
          plotClassName="flex flex-col gap-7"
          legend={
            <>
              <LegendSwatch color="#8A847C" label="Measured bytes" />
              <LegendSwatch color="#8A847C" label="Estimated from repo size" hatched />
            </>
          }
          footer={
            stack.leaderChanged && stack.leaderAll && stack.leaderRecent ? (
              <p className="m-0 border-t border-white/[0.08] pt-3 text-[13px] text-fg/90">
                Leading language moved from <strong className="font-medium text-fg">{stack.leaderAll}</strong> overall to{' '}
                <strong className="font-medium text-fg">{stack.leaderRecent}</strong> in recent work.
              </p>
            ) : null
          }
        >
          <RibbonRow
            label="All original projects"
            sub={`${stack.allRepoCount} ${stack.allRepoCount === 1 ? 'repo' : 'repos'}`}
            share={stack.all}
          />
          {recentRow}
        </ChartFrame>
      </RevealItem>
    </Section>
  );
}
