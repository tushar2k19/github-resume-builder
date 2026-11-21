import { motion } from 'framer-motion';
import { Building2, ExternalLink, Link2, MapPin } from 'lucide-react';
import type { ResumeModel } from '../../lib/types';
import { CountUp, RevealGroup, RevealItem } from '../../ui/motion';
import type { WorkCard } from '../../ui/work';
import { OrreryScene } from '../scene/OrreryScene';
import { ChartFrame } from './ChartFrame';

function avatarSrc(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}s=192`;
}

function blogHref(blog: string): string {
  return /^https?:\/\//i.test(blog) ? blog : `https://${blog}`;
}

export function Identity({
  model,
  featured,
  onSelectRepo,
}: {
  model: ResumeModel;
  featured: WorkCard[];
  onSelectRepo: (name: string) => void;
}) {
  const { profile, scope, stack } = model;
  const dominant = stack.all.entries.find((e) => e.name !== 'Other') ?? null;
  const stats: Array<{ label: string; value: number }> = [
    { label: 'Original projects', value: scope.originals },
    { label: 'Public repos', value: profile.publicRepos },
    { label: 'Followers', value: profile.followers },
    { label: 'Years on GitHub', value: profile.accountAgeYears },
  ];
  const meta: Array<{ icon: typeof MapPin; text: string; href?: string }> = [];
  if (profile.location) meta.push({ icon: MapPin, text: profile.location });
  if (profile.company) meta.push({ icon: Building2, text: profile.company });
  if (profile.blog) meta.push({ icon: Link2, text: profile.blog.replace(/^https?:\/\//i, ''), href: blogHref(profile.blog) });

  return (
    <RevealGroup as="section" id="identity" className="relative">
      <div className="relative p-5 sm:p-8" style={{ borderRadius: 12 }}>
        {/* Bare surface shared with the landing card (layoutId) so the stage morphs into the sheet. */}
        <motion.div
          layoutId="hero-surface"
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            borderRadius: 12,
            background: '#141311',
            border: '1px solid rgba(255,248,240,0.08)',
          }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
          <div className="flex min-w-0 flex-col gap-6">
            <RevealItem className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <img
                src={avatarSrc(profile.avatarUrl)}
                alt=""
                width={88}
                height={88}
                className="h-[88px] w-[88px] shrink-0 rounded-full object-cover"
                style={{ boxShadow: '0 0 0 3px #141311, 0 0 0 4px rgba(255,248,240,0.22)' }}
              />
              <div className="min-w-0">
                <p className="num m-0 text-[11px] uppercase tracking-[0.14em] text-muted">GitHub resume</p>
                <h1 className="m-0 mt-1 break-words text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[2.7rem]">
                  {profile.name ?? profile.login}
                </h1>
                <div aria-hidden="true" className="draw-line mt-2 h-px w-16 bg-glow" />
                <a
                  href={profile.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="num mt-2 inline-flex items-center gap-1 text-[13px] text-muted no-underline hover:text-fg"
                >
                  @{profile.login}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            </RevealItem>

            <RevealItem className="flex flex-col gap-3">
              <p className="m-0 max-w-[34ch] text-[1.35rem] font-medium leading-snug tracking-[-0.01em] text-fg sm:text-[1.6rem]">
                {model.headline}
              </p>
              {profile.bio && <p className="m-0 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">{profile.bio}</p>}
              {meta.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
                  {meta.map(({ icon: Icon, text, href }) => (
                    <li key={text} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                      <Icon size={13} aria-hidden="true" />
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="text-muted underline-offset-2 hover:text-fg hover:underline">
                          {text}
                        </a>
                      ) : (
                        text
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </RevealItem>

            <RevealItem as="div">
              <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-5 border-t border-white/[0.08] p-0 pt-5 sm:grid-cols-4">
                {stats.map((s) => (
                  <li key={s.label}>
                    <div className="num text-[1.6rem] font-medium leading-none text-fg">
                      <CountUp value={s.value} />
                    </div>
                    <div className="mt-1.5 text-[12px] text-muted">{s.label}</div>
                  </li>
                ))}
              </ul>
            </RevealItem>
          </div>

          <RevealItem className="min-w-0">
            <ChartFrame
              chip="Repo orrery"
              title="Featured work, newest inward"
              meta={`${Math.min(featured.length, 6)} ${featured.length === 1 ? 'body' : 'bodies'}`}
              summary={`Orrery of ${featured.length} featured repositories around ${dominant ? dominant.name : 'no dominant language'}. Distance is recency, size is repository size, angle is creation order.`}
              empty={featured.length === 0 ? 'No original project with content yet, so there is no orrery.' : null}
              tipHint="Hover or focus a project to read it. Select it to jump to its row."
              legend={
                <>
                  <span>Center: {dominant ? dominant.name : 'top language'}</span>
                  <span>Distance: recency</span>
                  <span>Size: repo size (log)</span>
                </>
              }
            >
              <OrreryScene dominant={dominant} featured={featured} onSelectRepo={onSelectRepo} />
            </ChartFrame>
          </RevealItem>
        </div>
      </div>
    </RevealGroup>
  );
}
