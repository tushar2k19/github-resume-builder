import { lazy, useCallback, useMemo, useState } from 'react';
import { formatSize } from '../../lib/analyze';
import type { LanguageEntry } from '../../lib/types';
import { describeAgo } from '../../ui/share';
import type { WorkCard } from '../../ui/work';
import { useSetTip } from '../resume/ChartFrame';
import { OrreryStill } from './OrreryStill';
import { SceneFrame } from './SceneFrame';
import { orreryLayout, type OrreryBody } from './layout';

const LazyOrrery = lazy(() => import('./ProjectOrrery'));

function detail(b: OrreryBody): string {
  return `${b.name} · ${b.language ?? 'no primary language'} · ${formatSize(b.sizeKb)} · last push ${describeAgo(b.pushedAt)}`;
}

/**
 * One repo orrery: the dominant language at the center, one small body per featured project.
 * The text list under it does the same hover (names the repo in the frame tooltip) and click
 * (scrolls to its row) as the bodies, so the canvas is never the only control.
 */
export function OrreryScene({
  dominant,
  featured,
  onSelectRepo,
}: {
  dominant: LanguageEntry | null;
  featured: WorkCard[];
  onSelectRepo: (name: string) => void;
}) {
  const setTip = useSetTip();
  const [active, setActive] = useState<string | null>(null);
  const layout = useMemo(() => orreryLayout(dominant, featured), [dominant, featured]);

  const hover = useCallback(
    (name: string | null) => {
      setActive(name);
      const b = name ? layout.bodies.find((x) => x.name === name) : undefined;
      setTip(b ? detail(b) : null);
    },
    [setTip, layout],
  );

  const label = `Repo orrery: ${layout.center.name} at the center, ${layout.bodies.length} featured ${
    layout.bodies.length === 1 ? 'project' : 'projects'
  } in orbit. Distance is recency, newest inward; size is repository size.`;

  return (
    <div>
      <SceneFrame
        label={label}
        className="h-[240px] overflow-hidden rounded-plot border border-white/[0.06] bg-[#0A0908] sm:h-[280px]"
        still={<OrreryStill layout={layout} activeName={active} onHover={hover} onSelect={onSelectRepo} />}
        live={(running) => (
          <LazyOrrery layout={layout} running={running} activeName={active} onHover={hover} onSelect={onSelectRepo} />
        )}
      />
      <ul className="m-0 mt-3 flex list-none flex-col gap-0.5 p-0" aria-label="Featured projects in the orrery, newest inward">
        {layout.bodies.map((b) => (
          <li key={b.name}>
            <button
              type="button"
              onMouseEnter={() => hover(b.name)}
              onMouseLeave={() => hover(null)}
              onFocus={() => hover(b.name)}
              onBlur={() => hover(null)}
              onClick={() => onSelectRepo(b.name)}
              aria-label={`${detail(b)}. Go to its row.`}
              className="num inline-flex min-h-[28px] w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-[12px] transition-colors"
              style={{ color: active === b.name ? '#F3F0EA' : '#8A847C' }}
            >
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <span className="truncate">{b.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
