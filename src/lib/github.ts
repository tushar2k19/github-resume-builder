/**
 * GitHub REST client for the resume (browser, axios, public data only).
 *
 * SHAPE: two-phase result via one callback.
 *
 *   const model = await loadResume('octocat', { onUpdate: (m) => setModel(m) });
 *
 *   1. Core phase (3 calls in parallel): /users/:u, /users/:u/repos, /users/:u/events/public.
 *      `onUpdate` is called once with a model where `phase === 'core'`; the sheet can render.
 *   2. Enrichment phase (up to 10 calls, 4 at a time): /repos/:o/:r/languages for the top 6
 *      original repos, /repos/:o/:r/readme for the 4 featured repos.
 *   3. The returned promise resolves with the final model (`phase === 'complete'`).
 *      `onUpdate` is NOT called for the final model; use the resolved value.
 *
 * `onUpdate` is skipped when there is nothing to enrich (no repos, or the core calls were cut
 * short). Budget: 3 + 6 + 4 = 13 requests, fewer on cache hits.
 *
 * ERRORS: rejects with `ResumeError` (kind: invalid-username | not-found | organization |
 * rate-limit | forbidden | network | unknown) only when the user itself cannot be loaded.
 * If /users/:u succeeds and anything else is rate limited (403/429) or fails, the model is
 * still returned with `partial` set and `rateLimit.resetAt` filled. Aborting through
 * `options.signal` rejects with axios' CanceledError (check `axios.isCancel`).
 *
 * CACHE: language byte maps and README excerpts live in localStorage under
 * `ghresume:v1:<kind>:<full_name>:<pushed_at>`. A push changes the key, so stale entries are
 * never read (and are pruned on write). Cache hits cost no requests.
 *
 * TOKEN: optional `VITE_GITHUB_TOKEN` (see .env.example). It is sent as a Bearer header and is
 * never logged. Anything in `VITE_*` ships inside the client bundle: use it for local runs only.
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
  FEATURED_COUNT,
  LANGUAGE_TARGET_COUNT,
  MAX_REPOS,
  buildResumeModel,
  pickLanguageTargets,
  rankFeatured,
  toRepoLite,
} from './analyze';
import { createLogger, type BuildLogger } from './log';
import type {
  PartialInfo,
  RateLimitInfo,
  RawEvent,
  RawReadme,
  RawRepo,
  RawUser,
  RepoLite,
  RequestStats,
  ResumeErrorKind,
  ResumeModel,
} from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoadOptions {
  /** Called once with the core-phase model before languages/READMEs arrive. */
  onUpdate?: (model: ResumeModel) => void;
  signal?: AbortSignal;
  /** Override the clock (tests). */
  now?: Date;
  /** Set false to silence console output; the on-page log is always recorded. */
  console?: boolean;
}

export class ResumeError extends Error {
  readonly kind: ResumeErrorKind;
  readonly status: number | null;
  /** ISO time when the rate limit resets, for kind "rate-limit" */
  readonly resetAt: string | null;
  /** Build log up to the failure, so the UI can show it */
  readonly log: ResumeModel['log'];

  constructor(
    kind: ResumeErrorKind,
    message: string,
    details: { status?: number | null; resetAt?: string | null; log?: ResumeModel['log'] } = {},
  ) {
    super(message);
    this.name = 'ResumeError';
    this.kind = kind;
    this.status = details.status ?? null;
    this.resetAt = details.resetAt ?? null;
    this.log = details.log ?? [];
  }
}

/** Accepts "octocat", "@octocat", or a github.com profile URL. Returns null if invalid. */
export function normalizeUsername(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0] ?? '';
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(cleaned) ? cleaned : null;
}

export async function loadResume(username: string, options: LoadOptions = {}): Promise<ResumeModel> {
  const log = createLogger({ console: options.console ?? true });
  const login = normalizeUsername(username);
  if (!login) {
    log.error('input', `"${username.trim()}" is not a valid GitHub username.`);
    throw new ResumeError(
      'invalid-username',
      'That does not look like a GitHub username. Use letters, numbers, and single hyphens (up to 39 characters).',
      { log: log.entries() },
    );
  }
  return new Loader(login, log, options).run();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.github.com';
const CACHE_PREFIX = 'ghresume:v1:';
const CACHE_MAX_AGE_MS = 7 * 24 * 3_600_000;
const README_EXCERPT_CHARS = 6000;
const ENRICH_CONCURRENCY = 4;

type CallResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; kind: 'not-found' | 'rate-limit' | 'forbidden' | 'network' | 'unknown'; message: string; resetAt: string | null };

type LocalCache = { get<T>(kind: string, repo: RepoLite): T | undefined; set(kind: string, repo: RepoLite, data: unknown): void };

function readToken(): string | null {
  const raw = (import.meta.env.VITE_GITHUB_TOKEN as string | undefined)?.trim();
  return raw ? raw : null;
}

function createCache(): LocalCache {
  const storage = (): Storage | null => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // blocked (privacy mode, sandboxed iframe)
    }
  };
  const keyOf = (kind: string, repo: RepoLite): string => `${CACHE_PREFIX}${kind}:${repo.fullName}:${repo.pushedAt}`;

  return {
    get<T>(kind: string, repo: RepoLite): T | undefined {
      const store = storage();
      if (!store) return undefined;
      try {
        const raw = store.getItem(keyOf(kind, repo));
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { t?: number; data?: T };
        if (typeof parsed.t !== 'number' || Date.now() - parsed.t > CACHE_MAX_AGE_MS) return undefined;
        return parsed.data;
      } catch {
        return undefined;
      }
    },
    set(kind: string, repo: RepoLite, data: unknown): void {
      const store = storage();
      if (!store) return;
      const key = keyOf(kind, repo);
      try {
        // Drop entries for older pushes of the same repo.
        const stalePrefix = `${CACHE_PREFIX}${kind}:${repo.fullName}:`;
        const stale: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(stalePrefix) && k !== key) stale.push(k);
        }
        stale.forEach((k) => store.removeItem(k));
        store.setItem(key, JSON.stringify({ t: Date.now(), data }));
      } catch {
        // Quota exceeded or storage disabled: caching is best-effort.
      }
    },
  };
}

function decodeBase64Utf8(content: string): string {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

function formatReset(resetAt: string | null, authenticated: boolean): string {
  const hint = authenticated ? '' : ' Adding VITE_GITHUB_TOKEN raises the limit from 60 to 5,000 requests per hour.';
  if (!resetAt) return `GitHub's rate limit was reached; try again later.${hint}`;
  const ms = Date.parse(resetAt) - Date.now();
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const clock = new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `GitHub's rate limit was reached; it resets at ${clock} (in about ${minutes} min).${hint}`;
}

class Loader {
  private readonly http: AxiosInstance;
  private readonly cache = createCache();
  private readonly stats: RequestStats = { made: 0, cacheHits: 0 };
  private readonly rate: RateLimitInfo;
  private limited = false;
  private readonly now: Date;

  constructor(
    private readonly login: string,
    private readonly log: BuildLogger,
    private readonly options: LoadOptions,
  ) {
    const token = readToken();
    this.http = axios.create({
      baseURL: API_BASE,
      timeout: 15_000,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      validateStatus: () => true, // statuses are handled explicitly
    });
    this.rate = { remaining: null, limit: null, resetAt: null, authenticated: token !== null };
    this.now = options.now ?? new Date();
  }

  // ---- low-level request ---------------------------------------------------

  private snapshotRate(): RateLimitInfo {
    return { ...this.rate };
  }

  private readRateHeaders(res: AxiosResponse): void {
    const h = res.headers as Record<string, unknown>;
    const remaining = Number(h['x-ratelimit-remaining']);
    const limit = Number(h['x-ratelimit-limit']);
    const reset = Number(h['x-ratelimit-reset']);
    if (h['x-ratelimit-remaining'] !== undefined && Number.isFinite(remaining)) this.rate.remaining = remaining;
    if (h['x-ratelimit-limit'] !== undefined && Number.isFinite(limit)) this.rate.limit = limit;
    if (h['x-ratelimit-reset'] !== undefined && Number.isFinite(reset) && reset > 0) {
      this.rate.resetAt = new Date(reset * 1000).toISOString();
    }
  }

  private async call<T>(step: string, path: string, params?: Record<string, string | number>): Promise<CallResult<T>> {
    this.stats.made++;
    let res: AxiosResponse<T>;
    try {
      res = await this.http.get<T>(path, { params, signal: this.options.signal });
    } catch (err) {
      if (axios.isCancel(err)) throw err;
      this.log.error(step, `Network error calling ${path}.`);
      return { ok: false, status: null, kind: 'network', message: 'Could not reach api.github.com.', resetAt: null };
    }

    this.readRateHeaders(res);
    if (res.status >= 200 && res.status < 300) {
      this.log.info(step, `GET ${path} -> ${res.status}`, {
        remaining: this.rate.remaining,
      });
      return { ok: true, status: res.status, data: res.data };
    }

    const body = res.data as unknown as { message?: string } | undefined;
    const message = typeof body?.message === 'string' ? body.message : `HTTP ${res.status}`;
    const headers = res.headers as Record<string, unknown>;
    const retryAfter = Number(headers['retry-after']);

    if (res.status === 404) {
      this.log.warn(step, `GET ${path} -> 404`);
      return { ok: false, status: 404, kind: 'not-found', message, resetAt: null };
    }

    const rateLimited =
      res.status === 429 ||
      (res.status === 403 &&
        (this.rate.remaining === 0 || /rate limit|abuse|secondary/i.test(message) || Number.isFinite(retryAfter)));
    if (rateLimited) {
      this.limited = true;
      // Secondary limits give Retry-After; primary limits give X-RateLimit-Reset.
      const resetAt =
        Number.isFinite(retryAfter) && this.rate.remaining !== 0
          ? new Date(Date.now() + retryAfter * 1000).toISOString()
          : this.rate.resetAt;
      if (resetAt) this.rate.resetAt = resetAt;
      this.log.error(step, `GET ${path} -> ${res.status} rate limited. ${formatReset(resetAt, this.rate.authenticated)}`, {
        remaining: this.rate.remaining,
      });
      return { ok: false, status: res.status, kind: 'rate-limit', message, resetAt };
    }

    this.log.error(step, `GET ${path} -> ${res.status}: ${message}`);
    return {
      ok: false,
      status: res.status,
      kind: res.status === 403 ? 'forbidden' : 'unknown',
      message,
      resetAt: null,
    };
  }

  // ---- orchestration ---------------------------------------------------------

  async run(): Promise<ResumeModel> {
    const { login, log } = this;
    log.info('start', `Building resume for ${login}.`, { authenticated: this.rate.authenticated });

    const u = encodeURIComponent(login);
    const [userRes, reposRes, eventsRes] = await Promise.all([
      this.call<RawUser>('user', `/users/${u}`),
      this.call<RawRepo[]>('repos', `/users/${u}/repos`, { type: 'owner', sort: 'pushed', per_page: MAX_REPOS }),
      this.call<RawEvent[]>('events', `/users/${u}/events/public`, { per_page: 100 }),
    ]);

    if (!userRes.ok) throw this.userError(userRes);
    const user = userRes.data;
    if (user.type === 'Organization') {
      log.error('user', `${login} is an organization account.`);
      throw new ResumeError(
        'organization',
        `${user.login} is an organization account. This resume reads one person's public repositories and activity, so try a user account.`,
        { log: log.entries() },
      );
    }

    const missing: PartialInfo['missing'] = [];
    let reason: PartialInfo['reason'] | null = null;
    let resetAt: string | null = null;
    const noteFailure = (what: 'repos' | 'events', res: CallResult<unknown>): void => {
      if (res.ok) return;
      missing.push(what);
      if (res.kind === 'rate-limit') {
        reason = 'rate-limit';
        resetAt = res.resetAt ?? resetAt;
      } else if (reason === null) {
        reason = 'error';
      }
    };
    noteFailure('repos', reposRes);
    noteFailure('events', eventsRes);

    const repos = reposRes.ok ? reposRes.data : null;
    const events = eventsRes.ok ? eventsRes.data : null;
    const languages: Record<string, Record<string, number>> = {};
    const readmes: Record<string, string | null> = {};

    const build = (phase: 'core' | 'complete'): ResumeModel =>
      buildResumeModel({
        user,
        repos,
        events,
        languages,
        readmes,
        phase,
        now: this.now,
        partial: this.partialInfo(reason, missing, resetAt),
        rateLimit: this.snapshotRate(),
        stats: { ...this.stats },
        log: log.entries(),
      });

    if (reposRes.ok) {
      log.info('repos', `Loaded ${reposRes.data.length} owned repositories (${user.public_repos} public).`);
      if (reposRes.data.length >= MAX_REPOS && user.public_repos > MAX_REPOS) {
        log.warn('repos', `Only the ${MAX_REPOS} most recently pushed of ${user.public_repos} repositories are analyzed.`);
      }
    }
    if (eventsRes.ok) log.info('events', `Loaded ${eventsRes.data.length} public events.`);

    // Enrichment targets come from the core data only.
    const lite = (repos ?? []).slice(0, MAX_REPOS).map(toRepoLite);
    const languageTargets = repos ? pickLanguageTargets(lite, this.now, LANGUAGE_TARGET_COUNT) : [];
    const readmeTargets = repos
      ? rankFeatured(lite, this.now)
          .slice(0, FEATURED_COUNT)
          .map((r) => r.repo)
      : [];

    if (languageTargets.length === 0 && readmeTargets.length === 0) {
      log.info('done', 'Nothing to enrich; finished with core data.');
      return build('complete');
    }

    this.options.onUpdate?.(build('core'));

    let languagesMissing = 0;
    let readmesMissing = 0;
    const tasks: Array<() => Promise<void>> = [
      ...languageTargets.map((repo) => async () => {
        if (!(await this.loadLanguages(repo, languages))) languagesMissing++;
      }),
      ...readmeTargets.map((repo) => async () => {
        if (!(await this.loadReadme(repo, readmes))) readmesMissing++;
      }),
    ];
    await runPool(tasks, ENRICH_CONCURRENCY, (task) => task());

    if (languagesMissing > 0) missing.push('languages');
    if (readmesMissing > 0) missing.push('readmes');
    if (this.limited) {
      reason = 'rate-limit';
      resetAt = this.rate.resetAt ?? resetAt;
    } else if ((languagesMissing > 0 || readmesMissing > 0) && reason === null) {
      reason = 'error';
    }

    log.info('done', `Finished: ${this.stats.made} requests, ${this.stats.cacheHits} cache hits.`, {
      remaining: this.rate.remaining,
    });
    return build('complete');
  }

  private partialInfo(
    reason: PartialInfo['reason'] | null,
    missing: PartialInfo['missing'],
    resetAt: string | null,
  ): PartialInfo | null {
    if (reason === null || missing.length === 0) return null;
    const unique = Array.from(new Set(missing));
    const what = unique.join(', ');
    const message =
      reason === 'rate-limit'
        ? `${formatReset(resetAt ?? this.rate.resetAt, this.rate.authenticated)} Partial sheet: missing ${what}.`
        : `Some GitHub requests failed. Partial sheet: missing ${what}.`;
    return { reason, missing: unique, resetAt: resetAt ?? this.rate.resetAt, message };
  }

  private userError(res: Extract<CallResult<unknown>, { ok: false }>): ResumeError {
    const log = this.log.entries();
    switch (res.kind) {
      case 'not-found':
        return new ResumeError('not-found', `No GitHub user named "${this.login}". Check the spelling.`, { status: 404, log });
      case 'rate-limit':
        return new ResumeError('rate-limit', formatReset(res.resetAt, this.rate.authenticated), {
          status: res.status,
          resetAt: res.resetAt,
          log,
        });
      case 'forbidden':
        return new ResumeError('forbidden', `GitHub refused the request (${res.status}): ${res.message}`, { status: res.status, log });
      case 'network':
        return new ResumeError('network', 'Could not reach api.github.com. Check your connection and try again.', { log });
      default:
        return new ResumeError('unknown', `GitHub returned an unexpected response (${res.status ?? 'no status'}): ${res.message}`, {
          status: res.status,
          log,
        });
    }
  }

  // ---- enrichment ------------------------------------------------------------

  /** Returns true when languages for this repo are available (cache or network). */
  private async loadLanguages(repo: RepoLite, into: Record<string, Record<string, number>>): Promise<boolean> {
    const cached = this.cache.get<Record<string, number>>('lang', repo);
    if (cached) {
      this.stats.cacheHits++;
      into[repo.fullName] = cached;
      this.log.info('languages', `${repo.fullName}: cache hit.`);
      return true;
    }
    if (this.limited) {
      this.log.warn('languages', `${repo.fullName}: skipped (rate limited).`);
      return false;
    }
    const res = await this.call<Record<string, number>>(
      'languages',
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/languages`,
    );
    if (!res.ok) return false;
    into[repo.fullName] = res.data;
    this.cache.set('lang', repo, res.data);
    return true;
  }

  /** Returns true when the README outcome is known (found or confirmed missing). */
  private async loadReadme(repo: RepoLite, into: Record<string, string | null>): Promise<boolean> {
    const cached = this.cache.get<{ text: string | null }>('readme', repo);
    if (cached && 'text' in cached) {
      this.stats.cacheHits++;
      into[repo.fullName] = cached.text;
      this.log.info('readme', `${repo.fullName}: cache hit.`);
      return true;
    }
    if (this.limited) {
      this.log.warn('readme', `${repo.fullName}: skipped (rate limited).`);
      return false;
    }
    const res = await this.call<RawReadme>(
      'readme',
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/readme`,
    );
    if (!res.ok) {
      if (res.kind === 'not-found') {
        into[repo.fullName] = null;
        this.cache.set('readme', repo, { text: null });
        return true;
      }
      return false;
    }
    let text: string | null = null;
    try {
      if (res.data.content && (res.data.encoding ?? 'base64') === 'base64') {
        text = decodeBase64Utf8(res.data.content).slice(0, README_EXCERPT_CHARS);
      }
    } catch {
      this.log.warn('readme', `${repo.fullName}: README could not be decoded.`);
    }
    into[repo.fullName] = text;
    this.cache.set('readme', repo, { text });
    return true;
  }
}
