import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import type { CoachNote, ResumeModel } from '../../lib/types';

const KIND_LABEL: Record<CoachNote['kind'], string> = {
  description: 'Description',
  readme: 'README',
  topics: 'Topics',
  license: 'License',
  'rate-limit': 'Rate limit',
  truncated: 'Coverage',
  sparse: 'Activity',
};

/**
 * Screen-only drawer. Problems with the profile live here, not on the page you send.
 * `print:hidden` plus data-print keeps it out of the PDF.
 */
export function Coach({ model, open, onClose }: { model: ResumeModel; open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const notes = model.coach;
  const global = notes.filter((n) => n.repo === null);
  const byRepo = new Map<string, CoachNote[]>();
  notes.filter((n) => n.repo !== null).forEach((n) => byRepo.set(n.repo as string, [...(byRepo.get(n.repo as string) ?? []), n]));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 print:hidden" data-print="hide">
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="complementary"
            aria-label="Coach: notes to improve this profile"
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-[420px] flex-col gap-4 overflow-y-auto p-5 text-fg"
            style={{ background: '#141311', borderLeft: '1px solid rgba(255,248,240,.08)', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="num m-0 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
                  <Lightbulb size={13} aria-hidden="true" /> Coach · screen only
                </p>
                <h2 className="m-0 text-[1.35rem] font-medium leading-tight">Notes to strengthen this profile</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">These never appear in the shared link, Markdown copy, or printed PDF.</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close coach"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-ground hover:border-glow/60"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {notes.length === 0 && (
              <p className="m-0 border-t border-white/[0.08] pt-3 text-[13.5px] text-muted">
                Nothing to flag. Descriptions, READMEs, topics and licenses look complete for featured work.
              </p>
            )}

            {global.length > 0 && (
              <section aria-label="Account-wide notes" className="flex flex-col gap-2">
                <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Account</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {global.map((n, i) => (
                    <NoteItem key={i} note={n} />
                  ))}
                </ul>
              </section>
            )}

            {Array.from(byRepo.entries()).map(([repo, list]) => (
              <section key={repo} aria-label={`Notes for ${repo}`} className="flex flex-col gap-2">
                <h3 className="num m-0 text-[13px] font-medium">{repo}</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {list.map((n, i) => (
                    <NoteItem key={i} note={n} />
                  ))}
                </ul>
              </section>
            ))}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function NoteItem({ note }: { note: CoachNote }) {
  return (
    <li className="rounded-plot border border-white/[0.08] bg-ground px-3 py-2.5 text-[13.5px] leading-snug text-fg/90">
      <span className="num mr-2 text-[10.5px] uppercase tracking-wide text-muted">{KIND_LABEL[note.kind]}</span>
      {note.message}
    </li>
  );
}
