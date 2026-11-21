import { type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import type { ResumeErrorKind } from '../../lib/types';
import { usePrefersReducedMotion } from '../../ui/hooks';
import { formatResetTime } from '../../ui/share';
import { MotionToggle } from '../MotionToggle';
import { LoadRail } from '../resume/LoadRail';
import { OrreryStill } from '../scene/OrreryStill';
import { PREVIEW_LAYOUT } from '../scene/layout';

export interface StageError {
  kind: ResumeErrorKind;
  message: string;
  resetAt: string | null;
}

const ERROR_TITLE: Record<ResumeErrorKind, string> = {
  'not-found': 'No such GitHub user',
  organization: 'That is an organization account',
  'rate-limit': 'GitHub rate limit reached',
  forbidden: 'GitHub refused the request',
  network: 'Could not reach GitHub',
  'invalid-username': 'That is not a GitHub username',
  unknown: 'GitHub sent an unexpected response',
};

const PILLARS = ['Languages by bytes', 'Selected work', 'Signals', 'Rhythm', 'Orrery'];

export function SearchStage({
  value,
  onChange,
  onSubmit,
  onPick,
  loading,
  error,
  sample,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPick: (name: string) => void;
  loading: boolean;
  error: StageError | null;
  sample: string;
}) {
  const reduce = usePrefersReducedMotion();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!loading) onSubmit();
  };
  const reset = formatResetTime(error?.resetAt ?? null);

  return (
    <motion.div
      className="fixed inset-0 z-30 overflow-y-auto overflow-x-hidden bg-ground print:hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      data-print="hide"
    >
      {/* One faint green radial behind the field. Static. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{ backgroundImage: 'radial-gradient(640px 360px at 28% 46%, rgba(61,220,132,0.06), transparent 70%)' }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-page flex-col items-stretch justify-center gap-10 px-4 py-12 sm:px-6 min-[880px]:flex-row min-[880px]:items-center min-[880px]:gap-12">
        <div className="absolute right-4 top-4 sm:right-6">
          <MotionToggle />
        </div>

        <div className="flex w-full max-w-[560px] flex-col gap-6 min-[880px]:w-[54%]">
          <div>
            <p className="num m-0 mb-3 text-[11px] uppercase tracking-[0.16em] text-muted">GitHub resume</p>
            <h1 className="m-0 text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.025em] text-fg sm:text-[3.3rem]">
              Your GitHub, written like a résumé.
            </h1>
            <div aria-hidden="true" className="draw-line mt-4 h-px w-16 bg-glow" />
            <p className="m-0 mt-4 max-w-[46ch] text-[16px] leading-relaxed text-muted">
              Paste a username or a profile link. You get one page you can send: what this person builds, in what, how
              recently, and where to look first. Public data only.
            </p>
          </div>

          <motion.form
            onSubmit={submit}
            className="relative p-5 sm:p-6"
            style={{ borderRadius: 12 }}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-busy={loading}
          >
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
            <div className="relative flex flex-col gap-4">
              <label htmlFor="username" className="text-[13px] font-medium text-fg">
                GitHub username or profile link
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="torvalds, @gaearon, github.com/…"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={loading}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'stage-error' : undefined}
                    className="h-12 w-full rounded-full border border-white/[0.12] bg-ground pl-11 pr-4 text-[15px] text-fg placeholder:text-muted focus:border-glow/70 focus:outline-none disabled:opacity-70"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border bg-ground px-6 text-[15px] font-medium text-fg transition-[box-shadow,transform] hover:shadow-[0_0_18px_-6px_rgba(61,220,132,0.5)] active:translate-y-px disabled:cursor-wait disabled:opacity-80"
                  style={{ borderColor: 'rgba(61,220,132,0.65)' }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                  {loading ? 'Reading GitHub…' : 'Generate resume'}
                </button>
              </div>

              {!loading && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-muted">Try</span>
                  {[sample, 'torvalds', 'gaearon'].map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onPick(name)}
                      className="num inline-flex min-h-[32px] items-center border-0 border-b border-white/[0.14] bg-transparent p-0 text-fg/90 transition-colors hover:border-glow hover:text-fg"
                    >
                      {i === 0 ? `View sample · ${name}` : name}
                    </button>
                  ))}
                </div>
              )}

              {loading && <LoadRail stage="core" />}

              {error && !loading && (
                <div id="stage-error" role="alert" className="rounded-plot border border-white/[0.14] bg-ground p-4">
                  <p className="m-0 flex items-center gap-2 text-[15px] font-medium text-fg">
                    <AlertCircle size={16} aria-hidden="true" className="text-muted" />
                    {ERROR_TITLE[error.kind]}
                  </p>
                  <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-muted">{error.message}</p>
                  {error.kind === 'rate-limit' && reset && (
                    <p className="num m-0 mt-2 text-[13px] text-muted">Limit resets at {reset}. Cached results still load instantly.</p>
                  )}
                </div>
              )}
            </div>
          </motion.form>
        </div>

        <div className="flex flex-1 flex-col items-center gap-5" aria-hidden="true">
          <div className="w-full max-w-[460px]">
            <OrreryStill layout={PREVIEW_LAYOUT} className="block h-auto w-full" />
          </div>
          <p className="num m-0 text-center text-[11.5px] tracking-wide text-muted">{PILLARS.join('  ·  ')}</p>
        </div>
      </div>
    </motion.div>
  );
}
