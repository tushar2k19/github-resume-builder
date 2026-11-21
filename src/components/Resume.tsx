import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { AnimatePresence } from 'framer-motion';
import { ResumeError, loadResume } from '../lib/github';
import type { ResumeModel } from '../lib/types';
import { parseGitHubUsername } from '../utils/parseGitHubUsername';
import {
  buildMarkdown,
  buildShareUrl,
  copyText,
  readUserParam,
  setUserParam,
  usePins,
} from '../ui/share';
import { composeWork } from '../ui/work';
import { Coach } from './resume/Coach';
import { Sheet } from './resume/Sheet';
import { Toolbar } from './resume/Toolbar';
import { SearchStage, type StageError } from './stage/SearchStage';

const SAMPLE_USERNAME = 'tushar2k19';

/** State owner: input, loading, errors, the model, share actions. Calls `loadResume`. */
export function Resume() {
  const [input, setInput] = useState(() => readUserParam() ?? '');
  const [model, setModel] = useState<ResumeModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StageError | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const { pins, toggle } = usePins();
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const autoLoaded = useRef(false);

  const load = useCallback(async (raw: string, history: 'push' | 'replace' | 'none') => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError({ kind: 'invalid-username', message: 'Enter a GitHub username or profile link.', resetAt: null });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const run = ++runRef.current;
    const login = parseGitHubUsername(trimmed) ?? trimmed;

    setLoading(true);
    setError(null);
    setCoachOpen(false);
    let urlSet = false;
    const syncUrl = (name: string): void => {
      if (urlSet) return;
      urlSet = true;
      if (history === 'none') return;
      const same = readUserParam()?.toLowerCase() === name.toLowerCase();
      setUserParam(name, same ? 'replace' : history);
    };

    try {
      const final = await loadResume(login, {
        signal: controller.signal,
        onUpdate: (core) => {
          if (runRef.current !== run) return;
          setModel(core);
          setInput(core.username);
          setLoading(false);
          syncUrl(core.username);
        },
      });
      if (runRef.current !== run) return;
      setModel(final);
      setInput(final.username);
      setLoading(false);
      syncUrl(final.username);
    } catch (err) {
      if (axios.isCancel(err) || runRef.current !== run) return;
      setLoading(false);
      if (err instanceof ResumeError) {
        setError({ kind: err.kind, message: err.message, resetAt: err.resetAt });
      } else {
        setError({ kind: 'unknown', message: err instanceof Error ? err.message : 'Something went wrong while building the sheet.', resetAt: null });
      }
    }
  }, []);

  const goHome = useCallback(() => {
    abortRef.current?.abort();
    runRef.current++;
    setModel(null);
    setLoading(false);
    setError(null);
    setCoachOpen(false);
    setUserParam(null, 'push');
  }, []);

  // ?u=username auto-loads once; back/forward follows the URL.
  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      const u = readUserParam();
      if (u) void load(u, 'replace');
    }
    const onPop = (): void => {
      const u = readUserParam();
      if (u) void load(u, 'none');
      else {
        abortRef.current?.abort();
        runRef.current++;
        setModel(null);
        setLoading(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  useEffect(() => {
    document.title = model ? `${model.profile.name ?? model.profile.login} · GitHub resume` : 'GitHub Resume';
  }, [model]);

  const activePins = useMemo(
    () => (model ? pins.filter((p) => model.repos.some((r) => r.name === p)) : []),
    [model, pins],
  );

  const copyLink = useCallback(
    () => (model ? copyText(buildShareUrl(model.username, activePins)) : Promise.resolve(false)),
    [model, activePins],
  );
  const copyMarkdown = useCallback(() => {
    if (!model) return Promise.resolve(false);
    const { cards } = composeWork(model, activePins);
    const md = buildMarkdown(
      model,
      cards.map((c) => ({
        name: c.repo.name,
        htmlUrl: c.repo.htmlUrl,
        summary: c.summary,
        language: c.repo.language,
        sizeKb: c.repo.sizeKb,
      })),
      buildShareUrl(model.username, activePins),
    );
    return copyText(md);
  }, [model, activePins]);

  return (
    <div className="relative min-h-screen bg-ground text-fg">
      <main className="relative mx-auto w-full max-w-page px-3 py-5 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {model && (
          <>
            <Toolbar
              onBack={goHome}
              onCopyLink={copyLink}
              onCopyMarkdown={copyMarkdown}
              onPrint={() => window.print()}
              onCoach={() => setCoachOpen(true)}
              coachCount={model.coach.length}
            />
            <Sheet model={model} pins={activePins} onTogglePin={toggle} />
          </>
        )}
      </main>

      <AnimatePresence>
        {!model && (
          <SearchStage
            key="stage"
            value={input}
            onChange={setInput}
            onSubmit={() => void load(input, 'push')}
            onPick={(name) => {
              setInput(name);
              void load(name, 'push');
            }}
            loading={loading}
            error={error}
            sample={SAMPLE_USERNAME}
          />
        )}
      </AnimatePresence>

      {model && <Coach model={model} open={coachOpen} onClose={() => setCoachOpen(false)} />}
    </div>
  );
}
