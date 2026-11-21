import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ResumeModel } from '../../lib/types';
import { CountUp, RevealItem, Ring } from '../../ui/motion';
import { cn } from '../../ui/tokens';
import { ChartFrame } from './ChartFrame';
import { Section } from './Section';

interface Dial {
  key: string;
  chip: string;
  enough: boolean;
  caption: string;
  how: string;
  /** 0..1 arc; null draws a year strip instead of a ring. */
  fraction: number | null;
  value: number;
  unit: string;
  decimals?: number;
  years?: number[];
  meta?: string;
}

function toDials(model: ResumeModel): Dial[] {
  const s = model.signals;
  const ls = s.lastShipped;
  const ft = s.followThrough;
  const ad = s.activeDays;
  const or = s.outsideReach;
  const os = s.originalShare;
  const yp = s.yearsWithProjects;
  return [
    {
      key: 'last',
      chip: 'Last shipped',
      enough: ls.enough,
      caption: ls.caption,
      how: ls.how,
      fraction: ls.originals > 0 ? ls.movedIn90Days / ls.originals : 0,
      value: ls.daysSincePush ?? 0,
      unit: 'days ago',
      meta: `${ls.movedIn90Days} of ${ls.originals} moved in 90 d`,
    },
    {
      key: 'follow',
      chip: 'Follow-through',
      enough: ft.enough,
      caption: ft.caption,
      how: ft.how,
      fraction: ft.share,
      value: Math.round((ft.share ?? 0) * 100),
      unit: '% sustained',
      meta: `${ft.sustained} of ${ft.sample} projects`,
    },
    {
      key: 'active',
      chip: 'Active days',
      enough: ad.enough,
      caption: ad.caption,
      how: ad.how,
      fraction: ad.windowDays ? ad.days / ad.windowDays : 0,
      value: ad.days,
      unit: ad.windowDays ? `of ${ad.windowDays} days` : 'days',
      meta: `${ad.events} events, UTC days`,
    },
    {
      key: 'reach',
      chip: 'Outside reach',
      enough: or.enough,
      caption: or.caption,
      how: or.how,
      fraction: or.share,
      value: or.events,
      unit: or.distinctRepos ? `events in ${or.distinctRepos} others' repos` : 'events outside own repos',
      meta: or.share !== null ? `${Math.round(or.share * 100)}% of ${or.sample}` : undefined,
    },
    {
      key: 'original',
      chip: 'Original work',
      enough: os.enough,
      caption: os.caption,
      how: os.how,
      fraction: os.share,
      value: Math.round((os.share ?? 0) * 100),
      unit: '% originals',
      meta: `${os.originals} original, ${os.forks} forks`,
    },
    {
      key: 'years',
      chip: 'Years with projects',
      enough: yp.enough,
      caption: yp.caption,
      how: yp.how,
      fraction: null,
      value: yp.count,
      unit: yp.count === 1 ? 'year' : 'years',
      years: yp.years,
    },
  ];
}

function How({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="num inline-flex min-h-[28px] items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] text-muted transition-colors hover:text-fg"
      >
        How?
        <ChevronDown size={13} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-muted">{text}</p>}
    </div>
  );
}

export function Signals({ model }: { model: ResumeModel }) {
  const dials = toDials(model);
  return (
    <Section
      id="signals"
      kicker="Signals"
      title="What the numbers say, in plain words"
      lead="Counts from public repositories and events. No seniority score, no ranking of the person."
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {dials.map((d) => (
          <RevealItem as="li" key={d.key} className="min-w-0">
            <ChartFrame
                      chip={d.chip}
              summary={d.enough ? d.caption : `${d.chip}: not enough public data.`}
              empty={d.enough ? null : 'Not enough public data'}
              plotClassName="py-2"
              className="h-full"
              footer={
                <>
                  {!d.enough && <p className="m-0 text-[13px] leading-snug text-fg">{d.caption}</p>}
                  <How text={d.how} />
                </>
              }
            >
              <div className="flex items-center gap-4">
                {d.fraction !== null ? (
                  <Ring fraction={d.fraction}>
                    <span className="num text-[1.1rem] font-medium leading-none text-fg">
                      <CountUp value={d.value} decimals={d.decimals ?? 0} />
                    </span>
                  </Ring>
                ) : (
                  <div className="num text-[2.2rem] font-medium leading-none text-fg">
                    <CountUp value={d.value} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="num text-[13px] font-medium text-fg">{d.unit}</div>
                  {d.meta && <div className="num mt-0.5 text-[11.5px] text-muted">{d.meta}</div>}
                </div>
              </div>
              {d.years && d.years.length > 0 && (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.08] p-0 pt-2" aria-label="Years that contain a created or pushed project">
                  {d.years.map((y) => (
                    <li key={y} className="num text-[11.5px] text-fg/80">
                      {y}
                    </li>
                  ))}
                </ul>
              )}
              <p className="m-0 mt-3 text-[13.5px] leading-snug text-fg/90">{d.caption}</p>
            </ChartFrame>
          </RevealItem>
        ))}
      </ul>
    </Section>
  );
}
