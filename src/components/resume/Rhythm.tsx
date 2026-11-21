import { useMemo, useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import type { EventMixSegment, ResumeModel, Rhythm as RhythmData } from '../../lib/types';
import { EASE, RevealItem } from '../../ui/motion';
import { usePrefersReducedMotion, usePrinting } from '../../ui/hooks';
import { GREEN, GREEN_RAMP, MIX_STEPS, cn } from '../../ui/tokens';
import { ChartFrame, LegendSwatch, useSetTip, useTipProps } from './ChartFrame';
import { Section } from './Section';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;

function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtShort(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function PanelTitle({ children, note }: { children: string; note?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
      <h4 className="m-0 text-[13px] font-medium text-fg">{children}</h4>
      {note && <span className="num text-[11px] text-muted">{note}</span>}
    </div>
  );
}

// --------------------------------------------------------------------------- beads

function BeadTimeline({ rhythm }: { rhythm: RhythmData }) {
  const setTip = useSetTip();
  const reduce = usePrefersReducedMotion();
  const printing = usePrinting();
  const still = reduce || printing;
  const [active, setActive] = useState(0);
  const days = rhythm.days;
  const first = days[0];
  const last = days[days.length - 1];

  const layout = useMemo(() => {
    if (!first || !last) return { pts: [] as Array<{ x: number; y: number; size: number }>, span: 0 };
    const t0 = Date.parse(first.day);
    const span = Math.max(1, (Date.parse(last.day) - t0) / DAY_MS);
    const max = Math.max(1, ...days.map((d) => d.count));
    const pts = days.map((d) => ({
      x: 3 + ((Date.parse(d.day) - t0) / DAY_MS / span) * 94,
      y: 12 + (d.count / max) * 66,
      size: 6 + (d.count / max) * 8,
    }));
    return { pts, span };
  }, [days, first, last]);

  if (!first || !last) return null;
  const tipFor = (i: number): string => {
    const d = days[i];
    return d ? `${fmtDay(d.day)} UTC · ${plural(d.count, 'event')}` : '';
  };
  const select = (i: number): void => {
    setActive(i);
    setTip(tipFor(i));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(Math.min(days.length - 1, active + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(Math.max(0, active - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(days.length - 1);
    }
  };
  const mid = days[Math.floor(days.length / 2)];

  return (
    <div>
      <div
        className="relative h-[120px] rounded-plot"
        tabIndex={0}
        role="group"
        aria-label={`Active days timeline, ${plural(days.length, 'active day')}. Use left and right arrow keys to move between days.`}
        onKeyDown={onKey}
        onFocus={() => setTip(tipFor(active))}
        onBlur={() => setTip(null)}
      >
        <div aria-hidden="true" className="absolute inset-x-0 bottom-[10%] h-px bg-white/[0.12]" />
        {layout.pts.map((p, i) => {
          const d = days[i];
          if (!d) return null;
          return (
            <span
              key={d.day}
              onMouseEnter={() => select(i)}
              onMouseLeave={() => setTip(null)}
              className="absolute block"
              style={{ left: `${p.x}%`, bottom: `${p.y}%`, width: p.size, height: p.size, marginLeft: -p.size / 2, marginBottom: -p.size / 2 }}
            >
              <motion.span
                aria-hidden="true"
                className="block h-full w-full rounded-full"
                style={{
                  background: GREEN,
                  opacity: 0.9,
                  boxShadow: active === i ? `0 0 0 3px #0C0B0A, 0 0 0 4px ${GREEN}` : '0 0 8px rgba(61,220,132,0.3)',
                }}
                initial={still ? false : { scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: Math.min(0.5, i * 0.02) }}
              />
            </span>
          );
        })}
      </div>
      <div className="num mt-1 flex justify-between text-[11px] text-muted" aria-hidden="true">
        <span>{fmtShort(`${first.day}T00:00:00Z`)}</span>
        {mid && days.length > 4 && <span>{fmtShort(`${mid.day}T00:00:00Z`)}</span>}
        <span>{fmtShort(`${last.day}T00:00:00Z`)}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- grid

function levelOf(count: number, max: number): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.min(4, 1 + Math.round(((count - 1) / Math.max(1, max - 1)) * 3)));
}

function HeatGrid({ rhythm }: { rhythm: RhythmData }) {
  const setTip = useSetTip();
  const [cur, setCur] = useState<{ r: number; c: number }>(() => {
    let best = { r: 0, c: 0, v: -1 };
    rhythm.grid.forEach((row, r) => row.forEach((v, c) => v > best.v && (best = { r, c, v })));
    return { r: best.r, c: best.c };
  });
  const tipFor = (r: number, c: number): string => {
    const n = rhythm.grid[r]?.[c] ?? 0;
    return `${WEEKDAYS[r]} ${String(c).padStart(2, '0')}:00 UTC · ${plural(n, 'event')}`;
  };
  const move = (r: number, c: number): void => {
    const next = { r: Math.max(0, Math.min(6, r)), c: Math.max(0, Math.min(23, c)) };
    setCur(next);
    setTip(tipFor(next.r, next.c));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const map: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    move(cur.r + d[0], cur.c + d[1]);
  };

  return (
    <div>
      <div
        className="rounded-plot"
        tabIndex={0}
        role="group"
        aria-label="Weekday by hour grid in UTC. Use arrow keys to move between cells."
        onKeyDown={onKey}
        onFocus={() => setTip(tipFor(cur.r, cur.c))}
        onBlur={() => setTip(null)}
      >
        <div className="grid items-center gap-[3px]" style={{ gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))' }}>
          <span aria-hidden="true" />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} aria-hidden="true" className="num text-center text-[9.5px] leading-none text-muted">
              {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
            </span>
          ))}
          {rhythm.grid.map((row, r) => (
            <GridRow key={r} r={r} row={row} max={rhythm.gridMax} cur={cur} onHover={(c) => { setCur({ r, c }); setTip(tipFor(r, c)); }} onLeave={() => setTip(null)} />
          ))}
        </div>
      </div>
      <div className="num mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span>Hour of day, UTC · events per hour:</span>
        <span>0</span>
        <span aria-hidden="true" className="inline-flex gap-[3px]">
          {GREEN_RAMP.map((c) => (
            <span key={c} className="inline-block h-3 w-5 rounded-[2px]" style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(255,248,240,.06)' }} />
          ))}
        </span>
        <span>{rhythm.gridMax}</span>
      </div>
    </div>
  );
}

function GridRow({
  r,
  row,
  max,
  cur,
  onHover,
  onLeave,
}: {
  r: number;
  row: number[];
  max: number;
  cur: { r: number; c: number };
  onHover: (c: number) => void;
  onLeave: () => void;
}) {
  return (
    <>
      <span aria-hidden="true" className="num pr-1 text-right text-[10px] leading-none text-muted">
        {WEEKDAYS[r]}
      </span>
      {row.map((v, c) => {
        const level = levelOf(v, max);
        const isCur = cur.r === r && cur.c === c;
        return (
          <span
            key={c}
            aria-hidden="true"
            onMouseEnter={() => onHover(c)}
            onMouseLeave={onLeave}
            className="block h-[14px] rounded-[2px]"
            style={{
              background: GREEN_RAMP[level],
              boxShadow: `inset 0 0 0 1px rgba(255,248,240,.05)${isCur ? `, 0 0 0 1px #0C0B0A, 0 0 0 2px ${GREEN}` : ''}`,
            }}
          />
        );
      })}
    </>
  );
}

// --------------------------------------------------------------------------- mix

function capMix(mix: EventMixSegment[]): EventMixSegment[] {
  if (mix.length <= 5) return mix;
  const head = mix.slice(0, 4);
  const rest = mix.slice(4);
  return [...head, { key: 'more', label: 'Other', count: rest.reduce((s, m) => s + m.count, 0) }];
}

function MixSegment({ seg, i }: { seg: EventMixSegment; i: number }) {
  const color = MIX_STEPS[i === 0 ? 0 : 1] ?? MIX_STEPS[0]!;
  const tip = useTipProps(`${seg.label}: ${plural(seg.count, 'event')}`);
  return (
    <div {...tip} role="img" className="flex h-5 min-w-[4px] items-center" style={{ flex: `${seg.count} 1 0` }}>
      <div className="h-[10px] w-full" style={{ background: color, opacity: i === 0 ? 0.75 : 0.55 - Math.min(i, 4) * 0.06, borderRadius: 3 }} />
    </div>
  );
}

function EventMix({ mix }: { mix: EventMixSegment[] }) {
  const reduce = usePrefersReducedMotion();
  const printing = usePrinting();
  const segs = capMix(mix);
  return (
    <div>
      <motion.div
        className="flex gap-[3px]"
        style={{ transformOrigin: 'left center' }}
        initial={reduce || printing ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {segs.map((s, i) => (
          <MixSegment key={s.key} seg={s} i={i} />
        ))}
      </motion.div>
      <ul className="num m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11.5px] text-muted">
        {segs.map((s, i) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: MIX_STEPS[i === 0 ? 0 : 1] }} />
            {s.label} <span className="text-fg/80">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------- sparse mosaic

function Mosaic({ model }: { model: ResumeModel }) {
  const { mosaic } = model.rhythm;
  const setTip = useSetTip();
  const years = mosaic.years.slice(-10);
  const cells = new Map(mosaic.cells.map((c) => [`${c.year}-${c.month}`, c]));
  return (
    <div>
      <PanelTitle note={mosaic.years.length > 10 ? 'last 10 years' : undefined}>Repositories created and pushed, by month</PanelTitle>
      <div className="overflow-x-auto" role="group" aria-label="Year by month mosaic of repository activity">
        <div className="grid min-w-[300px] gap-[3px]" style={{ gridTemplateColumns: 'auto repeat(12, minmax(0, 1fr))' }}>
          <span aria-hidden="true" />
          {MONTHS.map((m, i) => (
            <span key={i} aria-hidden="true" className="num text-center text-[10px] text-muted">
              {m}
            </span>
          ))}
          {years.map((y) => (
            <MosaicRow key={y} year={y} cells={cells} setTip={setTip} />
          ))}
        </div>
      </div>
      <p className="num m-0 mt-2 text-[11px] text-muted">Number in a cell = repositories created plus pushed that month.</p>
    </div>
  );
}

function MosaicRow({
  year,
  cells,
  setTip,
}: {
  year: number;
  cells: Map<string, { created: number; pushed: number }>;
  setTip: (t: string | null) => void;
}) {
  return (
    <>
      <span className="num pr-1 text-right text-[10.5px] leading-[26px] text-muted">{year}</span>
      {MONTH_NAMES.map((name, m) => {
        const cell = cells.get(`${year}-${m}`);
        const total = cell ? cell.created + cell.pushed : 0;
        const level = Math.min(4, total);
        const text = `${name} ${year}: ${plural(cell?.created ?? 0, 'repository')} created, ${cell?.pushed ?? 0} pushed`;
        return (
          <span
            key={m}
            tabIndex={total > 0 ? 0 : undefined}
            role={total > 0 ? 'img' : undefined}
            aria-label={total > 0 ? text : undefined}
            aria-hidden={total > 0 ? undefined : true}
            onFocus={() => total > 0 && setTip(text)}
            onBlur={() => setTip(null)}
            onMouseEnter={() => total > 0 && setTip(text)}
            onMouseLeave={() => setTip(null)}
            className="num flex h-[26px] items-center justify-center rounded-[3px] text-[11px]"
            style={{
              background: GREEN_RAMP[level],
              color: level === 4 ? '#0C0B0A' : '#F3F0EA',
              boxShadow: 'inset 0 0 0 1px rgba(255,248,240,.05)',
            }}
          >
            {total > 0 ? total : ''}
          </span>
        );
      })}
    </>
  );
}

// --------------------------------------------------------------------------- section

export function Rhythm({ model }: { model: ResumeModel }) {
  const { rhythm } = model;
  const w = rhythm.window;
  const metaParts: string[] = [];
  if (!rhythm.unavailable && w.from && w.to) {
    metaParts.push(`${fmtShort(w.from)} to ${fmtShort(w.to)} · UTC`);
    if (w.capped) metaParts.push('newest 100 events');
  } else if (rhythm.sparse && !rhythm.unavailable) {
    metaParts.push('repository dates');
  }

  const unavailableMsg =
    model.partial && model.partial.missing.includes('events')
      ? model.partial.message
      : 'Public events could not be loaded, so no rhythm is drawn.';

  const summary = rhythm.unavailable
    ? 'Activity rhythm is unavailable because public events did not load.'
    : rhythm.sparse
      ? `${rhythm.sparseSentence ?? 'Too few events to draw a rhythm.'}`
      : `${plural(rhythm.dots.length, 'public event')} on ${plural(rhythm.days.length, 'active day')} between ${fmtShort(w.from)} and ${fmtShort(w.to)} UTC, shown as a bead timeline, a weekday by hour grid, and an event mix.`;

  return (
    <Section
      id="rhythm"
      kicker="Rhythm"
      title="When the work happens"
      lead="Built from the most recent public events. Days with no events are left empty, never joined by a trend line."
    >
      <RevealItem>
        <ChartFrame
          chip="Activity rhythm"
          title={rhythm.sparse ? 'Too quiet to chart honestly' : 'Active days, hours, and kinds of work'}
          meta={metaParts.join(' · ') || undefined}
          summary={summary}
          empty={rhythm.unavailable ? unavailableMsg : null}
          tipHint={rhythm.sparse ? 'Hover or focus a month for its counts.' : 'Hover, focus, or use arrow keys on a chart for details.'}
          plotClassName="flex flex-col gap-7"
          legend={
            rhythm.sparse ? undefined : (
              <>
                <LegendSwatch color={GREEN} label="One bead = one active UTC day; size and height = events" />
                <span>Days with no events stay empty</span>
              </>
            )
          }
        >
          {rhythm.sparse ? (
            <>
              <p className="m-0 text-[15px] leading-relaxed text-fg">{rhythm.sparseSentence}</p>
              <Mosaic model={model} />
            </>
          ) : (
            <>
              <div>
                <PanelTitle note={`${plural(rhythm.days.length, 'active day')}`}>Active days</PanelTitle>
                <BeadTimeline rhythm={rhythm} />
              </div>
              <div className={cn('grid gap-6 lg:grid-cols-[1.5fr_1fr]')}>
                <div className="min-w-0">
                  <PanelTitle note="UTC">Weekday and hour</PanelTitle>
                  <HeatGrid rhythm={rhythm} />
                </div>
                <div className="min-w-0">
                  <PanelTitle note={`${rhythm.dots.length} events`}>What the events were</PanelTitle>
                  <EventMix mix={rhythm.mix} />
                </div>
              </div>
            </>
          )}
        </ChartFrame>
      </RevealItem>
    </Section>
  );
}
