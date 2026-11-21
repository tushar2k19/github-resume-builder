import { useState } from 'react';
import { ArrowLeft, Check, FileText, Lightbulb, Link2, Printer } from 'lucide-react';
import { MotionToggle } from '../MotionToggle';

type CopyKey = 'link' | 'md';

/** Screen-only actions above the sheet: new search, copy link, copy Markdown, print / save PDF, coach. */
export function Toolbar({
  onBack,
  onCopyLink,
  onCopyMarkdown,
  onPrint,
  onCoach,
  coachCount,
}: {
  onBack: () => void;
  onCopyLink: () => Promise<boolean>;
  onCopyMarkdown: () => Promise<boolean>;
  onPrint: () => void;
  onCoach: () => void;
  coachCount: number;
}) {
  const [copied, setCopied] = useState<CopyKey | 'fail' | null>(null);
  const run = async (key: CopyKey, fn: () => Promise<boolean>): Promise<void> => {
    const ok = await fn();
    setCopied(ok ? key : 'fail');
    window.setTimeout(() => setCopied(null), 2200);
  };

  const btn =
    'inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/[0.12] bg-card px-4 text-[13px] font-medium text-fg transition-colors hover:border-glow/60 active:scale-[0.98]';

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden" data-print="hide">
      <button type="button" onClick={onBack} className={btn}>
        <ArrowLeft size={16} aria-hidden="true" />
        New search
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => run('link', onCopyLink)} className={btn}>
          {copied === 'link' ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </button>
        <button type="button" onClick={() => run('md', onCopyMarkdown)} className={btn}>
          {copied === 'md' ? <Check size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
          {copied === 'md' ? 'Markdown copied' : 'Copy Markdown'}
        </button>
        <button type="button" onClick={onPrint} className={btn}>
          <Printer size={16} aria-hidden="true" />
          Print / save PDF
        </button>
        <button type="button" onClick={onCoach} className={btn}>
          <Lightbulb size={16} aria-hidden="true" />
          Coach
          {coachCount > 0 && <span className="num text-[11.5px] text-muted">{coachCount}</span>}
        </button>
        <MotionToggle className="ml-2" />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {copied === 'link' ? 'Link copied to clipboard' : copied === 'md' ? 'Markdown summary copied to clipboard' : copied === 'fail' ? 'Copy failed' : ''}
      </p>
      {copied === 'fail' && <p className="m-0 w-full text-[13px] text-muted">Copy was blocked by the browser. Select the address bar to copy the link.</p>}
    </div>
  );
}
