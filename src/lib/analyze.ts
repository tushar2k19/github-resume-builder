/**
 * Pure analysis for the GitHub resume.
 *
 * No network, no storage, no Date.now(): every function takes `now` so results
 * are reproducible. Forks are excluded from stack, freshness, follow-through,
 * and featured work. Nothing here uses AI; all text is templated from facts.
 */

import { OTHER_COLOR, languageColor } from './languages';
import type {
  ActiveDaysSignal,
  BuildFacts,
  CoachNote,
  DescriptionSource,
  EventDot,
  EventMixSegment,
  EventWindow,
  FollowThroughSignal,
  LanguageEntry,
  LanguageShare,
  LastShippedSignal,
  ModelInput,
  MosaicCell,
  OriginalShareSignal,
  OutsideReachSignal,
  Profile,
  RankParts,
  RawEvent,
  RawRepo,
  RepoLite,
  RepoMosaic,
  RepoScope,
  ResumeModel,
  Rhythm,
  RhythmDay,
  SelectedWorkItem,
  Signals,
  SkylineTower,
  ThenVsNow,
  YearsWithProjectsSignal,
} from './types';

// ---------------------------------------------------------------------------
// Constants (documented so the UI "How?" text can match the code)
// ---------------------------------------------------------------------------

export const DAY_MS = 86_400_000;
/** Only the 100 most recently pushed owned repos are ever requested. */
export const MAX_REPOS = 100;
export const FEATURED_COUNT = 4;
export const LANGUAGE_TARGET_COUNT = 6;
export const SKYLINE_MAX = 24;
export const MIN_EVENTS_FOR_RHYTHM = 10;
export const RECENT_WINDOW_DAYS = 180;
export const RECENCY_HALF_LIFE_DAYS = 180;
export const FOLLOW_THROUGH_MIN_SAMPLE = 3;
export const FOLLOW_THROUGH_MIN_AGE_DAYS = 30;
export const FOLLOW_THROUGH_MIN_SPAN_DAYS = 7;
export const OTHER_NAME = 'Other';

export const RANK_WEIGHTS = {
  recency: 0.35,
  substance: 0.25,
  legibility: 0.2,
  community: 0.2,
} as const;

/** Size (KB) at which substance saturates at 1.0 */
const SUBSTANCE_REF_KB = 20_000;
/** stars + forks + watchers at which community saturates at 1.0 */
const COMMUNITY_REF = 200;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function daysAgo(iso: string, now: Date): number {
  const ms = toMs(iso);
  if (ms === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - ms) / DAY_MS);
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** "today", "yesterday", "6 days ago", "5 months ago", "3 years ago" */
export function formatAgo(days: number): string {
  const d = Math.floor(days);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 60) return `${d} days ago`;
  if (d < 730) return `${Math.round(d / 30)} months ago`;
  return `${Math.floor(d / 365)} years ago`;
}

export function formatSize(sizeKb: number): string {
  if (sizeKb < 1024) return `${Math.max(0, Math.round(sizeKb))} KB`;
  const mb = sizeKb / 1024;
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function toRepoLite(raw: RawRepo): RepoLite {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    owner: raw.owner.login,
    description: raw.description,
    htmlUrl: raw.html_url,
    homepage: raw.homepage && raw.homepage.trim() ? raw.homepage.trim() : null,
    language: raw.language,
    topics: raw.topics ?? [],
    license: raw.license ? (raw.license.spdx_id && raw.license.spdx_id !== 'NOASSERTION' ? raw.license.spdx_id : raw.license.name) : null,
    sizeKb: raw.size,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.watchers_count,
    isFork: raw.fork,
    archived: raw.archived,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at ?? raw.created_at,
  };
}

/** Newest push first; stable tie-break on name. */
export function sortByPushed(repos: RepoLite[]): RepoLite[] {
  return repos.slice().sort((a, b) => {
    const diff = (toMs(b.pushedAt) ?? 0) - (toMs(a.pushedAt) ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

export const originalsOf = (repos: RepoLite[]): RepoLite[] => repos.filter((r) => !r.isFork);

// ---------------------------------------------------------------------------
// Description: description -> first real README paragraph -> "Language · size"
// ---------------------------------------------------------------------------

function cleanMarkdownLine(line: string): string {
  return line
    .replace(/\[\s*!\[[^\]]*\]\([^)]*\)\s*\]\([^)]*\)/g, '') // linked badges
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // inline links
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1') // reference links
    .replace(/<[^>]+>/g, '') // html tags
    .replace(/`+/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/^>\s?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const window = text.slice(0, maxLength);
  // Prefer a sentence end within the limit.
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd >= 40) return window.slice(0, sentenceEnd + 1);
  const space = window.lastIndexOf(' ');
  const cut = space >= 40 ? window.slice(0, space) : window;
  return `${cut.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

/**
 * First real paragraph of a README (~160 chars). Skips headings, badges,
 * images, HTML-only blocks, tables, lists, rules, and code fences.
 */
export function firstReadmeParagraph(markdown: string | null | undefined, maxLength = 160): string | null {
  if (!markdown) return null;
  const text = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '\n\n')
    .replace(/~~~[\s\S]*?~~~/g, '\n\n');

  for (const block of text.split(/\n\s*\n/)) {
    const rawLines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const kept: string[] = [];
    let skipBlock = false;
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i] ?? '';
      const next = rawLines[i + 1] ?? '';
      if (/^#{1,6}(\s|$)/.test(line)) continue; // ATX heading
      if (/^(=+|-+)$/.test(next) && !/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        i++; // setext heading and its underline
        continue;
      }
      if (/^([-*_]\s*){3,}$/.test(line) || /^=+$/.test(line)) continue; // rules
      if (/^\|/.test(line) || /^[-*+]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
        skipBlock = true; // tables and lists are not paragraphs
        break;
      }
      const cleaned = cleanMarkdownLine(line);
      if (cleaned) kept.push(cleaned);
    }
    if (skipBlock || kept.length === 0) continue;
    const paragraph = kept.join(' ').trim();
    const words = paragraph.split(/\s+/).length;
    if (paragraph.length < 20 || words < 3 || !/[A-Za-z]{3}/.test(paragraph)) continue;
    if (/^(table of contents|contents|license|licence)\b/i.test(paragraph)) continue;
    return truncateText(paragraph, maxLength);
  }
  return null;
}

export function describeRepo(
  repo: RepoLite,
  readmeText?: string | null,
): { text: string; source: DescriptionSource } {
  const description = repo.description?.trim();
  if (description && !/^no description( provided)?\.?$/i.test(description)) {
    return { text: description, source: 'description' };
  }
  const fromReadme = firstReadmeParagraph(readmeText);
  if (fromReadme) return { text: fromReadme, source: 'readme' };
  return { text: `${repo.language ?? 'Project'} · ${formatSize(repo.sizeKb)}`, source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Ranking (selected work)
// ---------------------------------------------------------------------------

export interface RankedRepo {
  repo: RepoLite;
  score: number;
  parts: RankParts;
}

/** Original, not archived, and has content. */
export const isFeatureCandidate = (repo: RepoLite): boolean =>
  !repo.isFork && !repo.archived && repo.sizeKb > 0;

export function legibilityOf(repo: RepoLite): number {
  const hasDescription = !!repo.description && repo.description.trim().length > 0;
  return (
    (hasDescription ? 0.4 : 0) +
    (repo.topics.length > 0 ? 0.2 : 0) +
    (repo.homepage ? 0.2 : 0) +
    (repo.license ? 0.2 : 0)
  );
}

export function scoreRepo(repo: RepoLite, now: Date): RankedRepo {
  const parts: RankParts = {
    recency: Math.pow(0.5, daysAgo(repo.pushedAt, now) / RECENCY_HALF_LIFE_DAYS),
    substance: clamp01(Math.log1p(Math.max(0, repo.sizeKb)) / Math.log1p(SUBSTANCE_REF_KB)),
    legibility: legibilityOf(repo),
    community: clamp01(
      Math.log1p(Math.max(0, repo.stars + repo.forks + repo.watchers)) / Math.log1p(COMMUNITY_REF),
    ),
  };
  const score =
    RANK_WEIGHTS.recency * parts.recency +
    RANK_WEIGHTS.substance * parts.substance +
    RANK_WEIGHTS.legibility * parts.legibility +
    RANK_WEIGHTS.community * parts.community;
  return { repo, score, parts };
}

function byScore(a: RankedRepo, b: RankedRepo): number {
  if (b.score !== a.score) return b.score - a.score;
  const pushed = (toMs(b.repo.pushedAt) ?? 0) - (toMs(a.repo.pushedAt) ?? 0);
  return pushed !== 0 ? pushed : a.repo.name.localeCompare(b.repo.name);
}

/** All feature candidates, best first. */
export function rankFeatured(repos: RepoLite[], now: Date): RankedRepo[] {
  return repos
    .filter(isFeatureCandidate)
    .map((r) => scoreRepo(r, now))
    .sort(byScore);
}

/**
 * Top originals to ask GitHub for byte counts. Same score as featured work,
 * but archived repos count here (they still show what someone writes).
 */
export function pickLanguageTargets(repos: RepoLite[], now: Date, limit = LANGUAGE_TARGET_COUNT): RepoLite[] {
  return repos
    .filter((r) => !r.isFork && r.sizeKb > 0)
    .map((r) => scoreRepo(r, now))
    .sort(byScore)
    .slice(0, limit)
    .map((r) => r.repo);
}

function reasonsFor(ranked: RankedRepo, now: Date): string[] {
  const { repo } = ranked;
  const reasons: string[] = [`Pushed ${formatAgo(daysAgo(repo.pushedAt, now))}`];
  reasons.push(`${formatSize(repo.sizeKb)} of repository content`);
  const present: string[] = [];
  if (repo.description?.trim()) present.push('a description');
  if (repo.topics.length > 0) present.push('topics');
  if (repo.homepage) present.push('a homepage');
  if (repo.license) present.push('a license');
  if (present.length >= 2) reasons.push(`Easy to read cold: has ${present.join(', ')}`);
  const community = repo.stars + repo.forks;
  if (community > 0) {
    reasons.push(`${plural(repo.stars, 'star')} · ${plural(repo.forks, 'fork')}`);
  }
  return reasons;
}

export function selectWork(
  repos: RepoLite[],
  now: Date,
  readmes: Record<string, string | null> = {},
  limit = FEATURED_COUNT,
): SelectedWorkItem[] {
  return rankFeatured(repos, now)
    .slice(0, limit)
    .map((ranked) => {
      const summary = describeRepo(ranked.repo, readmes[ranked.repo.fullName]);
      return {
        repo: ranked.repo,
        score: ranked.score,
        parts: ranked.parts,
        reasons: reasonsFor(ranked, now),
        summary: summary.text,
        summarySource: summary.source,
        languageColor: languageColor(ranked.repo.language),
      };
    });
}

export function buildSkyline(repos: RepoLite[], now: Date): SkylineTower[] {
  const picked = sortByPushed(originalsOf(repos).filter((r) => r.sizeKb > 0)).slice(0, SKYLINE_MAX);
  const maxLog = Math.max(1, ...picked.map((r) => Math.log1p(r.sizeKb)));
  return picked
    .map((r) => ({
      name: r.name,
      fullName: r.fullName,
      htmlUrl: r.htmlUrl,
      language: r.language,
      color: languageColor(r.language),
      sizeKb: r.sizeKb,
      height: clamp01(Math.log1p(r.sizeKb) / maxLog),
      recency: Math.pow(0.5, daysAgo(r.pushedAt, now) / RECENCY_HALF_LIFE_DAYS),
      createdAt: r.createdAt,
      pushedAt: r.pushedAt,
    }))
    .sort((a, b) => (toMs(a.createdAt) ?? 0) - (toMs(b.createdAt) ?? 0));
}

// ---------------------------------------------------------------------------
// Language share and then-vs-now
// ---------------------------------------------------------------------------

/**
 * Language share by bytes across original repos.
 * Repos with a /languages payload are measured; the rest are estimated as
 * size (KB) * 1024 bytes attributed to their primary language, and flagged.
 */
export function computeLanguageShare(
  repos: RepoLite[],
  languages: Record<string, Record<string, number>>,
  maxEntries = 8,
): LanguageShare {
  const acc = new Map<string, { measured: number; estimated: number }>();
  const bump = (name: string, kind: 'measured' | 'estimated', bytes: number): void => {
    if (bytes <= 0) return;
    const current = acc.get(name) ?? { measured: 0, estimated: 0 };
    current[kind] += bytes;
    acc.set(name, current);
  };

  let measuredRepos = 0;
  let estimatedRepos = 0;
  let unclassifiedRepos = 0;

  for (const repo of repos) {
    if (repo.isFork) continue;
    const payload = languages[repo.fullName];
    if (payload) {
      const names = Object.keys(payload);
      const total = names.reduce((sum, n) => sum + (payload[n] ?? 0), 0);
      if (total > 0) {
        measuredRepos++;
        names.forEach((n) => bump(n, 'measured', payload[n] ?? 0));
      } else {
        unclassifiedRepos++; // GitHub sees no code
      }
      continue;
    }
    if (repo.language && repo.sizeKb > 0) {
      estimatedRepos++;
      bump(repo.language, 'estimated', repo.sizeKb * 1024);
    } else {
      unclassifiedRepos++;
    }
  }

  const sorted = Array.from(acc.entries())
    .map(([name, v]) => ({ name, measured: v.measured, estimated: v.estimated, bytes: v.measured + v.estimated }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const totalBytes = sorted.reduce((sum, e) => sum + e.bytes, 0);

  const toEntry = (e: { name: string; measured: number; estimated: number; bytes: number }): LanguageEntry => ({
    name: e.name,
    color: e.name === OTHER_NAME ? OTHER_COLOR : languageColor(e.name),
    bytes: e.bytes,
    measuredBytes: e.measured,
    estimatedBytes: e.estimated,
    share: totalBytes > 0 ? e.bytes / totalBytes : 0,
    estimated: e.estimated > 0,
  });

  let head = sorted;
  let tail: typeof sorted = [];
  if (sorted.length > maxEntries) {
    head = sorted.slice(0, maxEntries - 1);
    tail = sorted.slice(maxEntries - 1);
  }
  const entries = head.map(toEntry);
  if (tail.length > 0) {
    entries.push(
      toEntry({
        name: OTHER_NAME,
        measured: tail.reduce((s, e) => s + e.measured, 0),
        estimated: tail.reduce((s, e) => s + e.estimated, 0),
        bytes: tail.reduce((s, e) => s + e.bytes, 0),
      }),
    );
  }

  return {
    entries,
    totalBytes,
    measuredRepos,
    estimatedRepos,
    unclassifiedRepos,
    hasEstimate: estimatedRepos > 0,
  };
}

function leaderOf(share: LanguageShare): string | null {
  const lead = share.entries.find((e) => e.name !== OTHER_NAME);
  return lead ? lead.name : null;
}

/** Then vs now: all originals, and originals pushed in the last 180 days. */
export function computeThenVsNow(
  repos: RepoLite[],
  languages: Record<string, Record<string, number>>,
  now: Date,
  windowDays = RECENT_WINDOW_DAYS,
): ThenVsNow {
  const originals = originalsOf(repos);
  const recent = originals.filter((r) => daysAgo(r.pushedAt, now) <= windowDays);
  const all = computeLanguageShare(originals, languages);
  const recentShare = computeLanguageShare(recent, languages);
  const leaderAll = leaderOf(all);
  const leaderRecent = leaderOf(recentShare);
  return {
    all,
    recent: recentShare,
    windowDays,
    recentRepoCount: recent.length,
    allRepoCount: originals.length,
    enough: recent.length > 0 && recentShare.totalBytes > 0,
    leaderAll,
    leaderRecent,
    leaderChanged: leaderAll !== null && leaderRecent !== null && leaderAll !== leaderRecent,
  };
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

export function computeLastShipped(repos: RepoLite[], now: Date): LastShippedSignal {
  const originals = originalsOf(repos);
  const newest = sortByPushed(originals)[0];
  const moved = originals.filter((r) => daysAgo(r.pushedAt, now) <= 90).length;
  const days = newest ? Math.floor(daysAgo(newest.pushedAt, now)) : null;
  return {
    enough: originals.length > 0,
    daysSincePush: days,
    newestRepo: newest ? newest.name : null,
    movedIn90Days: moved,
    originals: originals.length,
    caption:
      days === null
        ? 'No original projects to measure.'
        : `Last push ${formatAgo(days)}; ${moved} of ${plural(originals.length, 'original project')} moved in the last 90 days.`,
    how: 'Days since the newest push to a repository the user owns and did not fork, plus how many such repositories were pushed in the last 90 days. Uses pushed_at from the repository list.',
  };
}

export function computeFollowThrough(repos: RepoLite[], now: Date): FollowThroughSignal {
  const eligible = originalsOf(repos).filter((r) => daysAgo(r.createdAt, now) > FOLLOW_THROUGH_MIN_AGE_DAYS);
  const sustained = eligible.filter((r) => {
    const created = toMs(r.createdAt);
    const pushed = toMs(r.pushedAt);
    return created !== null && pushed !== null && (pushed - created) / DAY_MS >= FOLLOW_THROUGH_MIN_SPAN_DAYS;
  }).length;
  const enough = eligible.length >= FOLLOW_THROUGH_MIN_SAMPLE;
  return {
    enough,
    share: eligible.length > 0 ? sustained / eligible.length : null,
    sample: eligible.length,
    sustained,
    minSample: FOLLOW_THROUGH_MIN_SAMPLE,
    caption: enough
      ? `${sustained} of ${plural(eligible.length, 'original project')} older than 30 days kept getting pushes for a week or more.`
      : 'Not enough public data.',
    how: `Share of original repositories older than ${FOLLOW_THROUGH_MIN_AGE_DAYS} days whose created-to-last-push span is at least ${FOLLOW_THROUGH_MIN_SPAN_DAYS} days. Needs ${FOLLOW_THROUGH_MIN_SAMPLE} such repositories. GitHub does not expose the first push, so creation time stands in for it.`,
  };
}

interface CleanEvent {
  ms: number;
  type: string;
  repo: string;
  day: string;
}

function cleanEvents(events: RawEvent[] | null): CleanEvent[] {
  if (!events) return [];
  const out: CleanEvent[] = [];
  for (const e of events) {
    const ms = toMs(e.created_at);
    if (ms === null) continue;
    out.push({ ms, type: e.type ?? 'Unknown', repo: e.repo?.name ?? '', day: dayKey(ms) });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

export function computeEventWindow(events: RawEvent[] | null): EventWindow {
  const clean = cleanEvents(events);
  const first = clean[0];
  const last = clean[clean.length - 1];
  return {
    from: first ? new Date(first.ms).toISOString() : null,
    to: last ? new Date(last.ms).toISOString() : null,
    count: clean.length,
    capped: (events?.length ?? 0) >= 100,
  };
}

function windowText(window: EventWindow): string {
  if (!window.from || !window.to) return 'No public events were returned.';
  const from = window.from.slice(0, 10);
  const to = window.to.slice(0, 10);
  const span = from === to ? from : `${from} to ${to}`;
  const count = plural(window.count, 'event');
  return window.capped
    ? `${span} (UTC): the newest ${count}; older events were not fetched.`
    : `${span} (UTC): ${count}.`;
}

export function computeActiveDays(events: RawEvent[] | null): ActiveDaysSignal {
  const clean = cleanEvents(events);
  const days = new Set(clean.map((e) => e.day));
  const first = clean[0];
  const last = clean[clean.length - 1];
  const windowDays =
    first && last ? Math.round((dayKeyToUtcMs(last.day) - dayKeyToUtcMs(first.day)) / DAY_MS) + 1 : null;
  const enough = clean.length >= MIN_EVENTS_FOR_RHYTHM;
  return {
    enough,
    days: days.size,
    windowDays,
    events: clean.length,
    caption: enough
      ? `Public activity on ${days.size} of the ${plural(windowDays ?? 0, 'day')} between the first and last event fetched (UTC).`
      : 'Not enough public data.',
    how: `Distinct UTC days with at least one public event, measured over the actual span of the events GitHub returned (at most 100, at most 90 days old), not over a fixed window. Needs ${MIN_EVENTS_FOR_RHYTHM} events.`,
  };
}

export function computeOutsideReach(events: RawEvent[] | null, login: string): OutsideReachSignal {
  const me = login.toLowerCase();
  // Starring someone else's repo is not contributing to it.
  const contributions = cleanEvents(events).filter((e) => e.type !== 'WatchEvent' && e.repo);
  const outside = contributions.filter((e) => e.repo.split('/')[0]?.toLowerCase() !== me);
  const distinct = new Set(outside.map((e) => e.repo));
  const enough = contributions.length >= MIN_EVENTS_FOR_RHYTHM;
  return {
    enough,
    events: outside.length,
    sample: contributions.length,
    share: contributions.length > 0 ? outside.length / contributions.length : null,
    distinctRepos: distinct.size,
    caption: enough
      ? `${plural(outside.length, 'event')} in ${plural(distinct.size, 'repository', 'repositories')} owned by someone else.`
      : 'Not enough public data.',
    how: `Public events (stars excluded) whose repository owner is not this user, out of all such events fetched. Needs ${MIN_EVENTS_FOR_RHYTHM} events. Private work and contributions GitHub does not publish as events are invisible here.`,
  };
}

export function computeOriginalShare(repos: RepoLite[]): OriginalShareSignal {
  const originals = originalsOf(repos).length;
  const forks = repos.length - originals;
  return {
    enough: repos.length > 0,
    originals,
    forks,
    share: repos.length > 0 ? originals / repos.length : null,
    caption:
      repos.length > 0
        ? `${plural(originals, 'original project')} and ${plural(forks, 'fork')} among the repositories analyzed.`
        : 'Not enough public data.',
    how: 'Original (non-fork) repositories as a share of the owned public repositories analyzed.',
  };
}

export function computeYearsWithProjects(repos: RepoLite[]): YearsWithProjectsSignal {
  const years = new Set<number>();
  for (const r of originalsOf(repos)) {
    for (const iso of [r.createdAt, r.pushedAt]) {
      const ms = toMs(iso);
      if (ms !== null) years.add(new Date(ms).getUTCFullYear());
    }
  }
  const list = Array.from(years).sort((a, b) => a - b);
  return {
    enough: list.length > 0,
    years: list,
    count: list.length,
    caption:
      list.length > 0
        ? `Original projects were created or pushed in ${plural(list.length, 'different year')}.`
        : 'Not enough public data.',
    how: 'Distinct calendar years (UTC) in which an original repository was created or last pushed. Years where only earlier pushes happened are not visible from the repository list.',
  };
}

export function computeSignals(repos: RepoLite[], events: RawEvent[] | null, login: string, now: Date): Signals {
  return {
    lastShipped: computeLastShipped(repos, now),
    followThrough: computeFollowThrough(repos, now),
    activeDays: computeActiveDays(events),
    outsideReach: computeOutsideReach(events, login),
    originalShare: computeOriginalShare(repos),
    yearsWithProjects: computeYearsWithProjects(repos),
  };
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------

const EVENT_LABELS: Readonly<Record<string, { key: string; label: string }>> = {
  PushEvent: { key: 'PushEvent', label: 'Pushed' },
  PullRequestEvent: { key: 'PullRequestEvent', label: 'Pull requests' },
  PullRequestReviewEvent: { key: 'PullRequestReviewEvent', label: 'Reviews' },
  PullRequestReviewCommentEvent: { key: 'PullRequestReviewEvent', label: 'Reviews' },
  IssuesEvent: { key: 'IssuesEvent', label: 'Issues' },
  IssueCommentEvent: { key: 'IssueCommentEvent', label: 'Comments' },
  CommitCommentEvent: { key: 'IssueCommentEvent', label: 'Comments' },
  CreateEvent: { key: 'CreateEvent', label: 'Created' },
  DeleteEvent: { key: 'DeleteEvent', label: 'Deleted' },
  WatchEvent: { key: 'WatchEvent', label: 'Starred' },
  ForkEvent: { key: 'ForkEvent', label: 'Forked' },
  ReleaseEvent: { key: 'ReleaseEvent', label: 'Releases' },
};

export function computeEventMix(events: RawEvent[] | null): EventMixSegment[] {
  const counts = new Map<string, EventMixSegment>();
  for (const e of cleanEvents(events)) {
    const meta = EVENT_LABELS[e.type] ?? { key: 'Other', label: 'Other' };
    const current = counts.get(meta.key) ?? { key: meta.key, label: meta.label, count: 0 };
    current.count++;
    counts.set(meta.key, current);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function computeRepoMosaic(repos: RepoLite[]): RepoMosaic {
  const cells = new Map<string, MosaicCell>();
  const touch = (iso: string, field: 'created' | 'pushed'): void => {
    const ms = toMs(iso);
    if (ms === null) return;
    const d = new Date(ms);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const key = `${year}-${month}`;
    const cell = cells.get(key) ?? { year, month, created: 0, pushed: 0 };
    cell[field]++;
    cells.set(key, cell);
  };
  for (const r of originalsOf(repos)) {
    touch(r.createdAt, 'created');
    touch(r.pushedAt, 'pushed');
  }
  const list = Array.from(cells.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  const first = list[0];
  const last = list[list.length - 1];
  const years: number[] = [];
  if (first && last) {
    for (let y = first.year; y <= last.year; y++) years.push(y);
  }
  return { years, cells: list };
}

export function computeRhythm(events: RawEvent[] | null, repos: RepoLite[], unavailable = false): Rhythm {
  const clean = cleanEvents(events);
  const window = computeEventWindow(events);

  const dots: EventDot[] = clean.map((e) => ({
    at: new Date(e.ms).toISOString(),
    day: e.day,
    type: e.type,
    repo: e.repo,
  }));

  const perDay = new Map<string, number>();
  clean.forEach((e) => perDay.set(e.day, (perDay.get(e.day) ?? 0) + 1));
  const dayKeys = Array.from(perDay.keys()).sort();
  const days: RhythmDay[] = dayKeys.map((day, i) => {
    const prev = dayKeys[i - 1];
    return {
      day,
      count: perDay.get(day) ?? 0,
      joinedToPrevious: prev !== undefined && dayKeyToUtcMs(day) - dayKeyToUtcMs(prev) === DAY_MS,
    };
  });

  const grid: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let gridMax = 0;
  for (const e of clean) {
    const d = new Date(e.ms);
    const row = grid[d.getUTCDay()];
    if (!row) continue;
    const hour = d.getUTCHours();
    row[hour] = (row[hour] ?? 0) + 1;
    gridMax = Math.max(gridMax, row[hour] ?? 0);
  }

  const sparse = clean.length < MIN_EVENTS_FOR_RHYTHM;
  let sparseSentence: string | null = null;
  if (sparse && !unavailable) {
    sparseSentence =
      clean.length === 0
        ? 'No public events were returned for this account, so there is no activity rhythm to draw. Repository dates are shown instead.'
        : `Only ${plural(clean.length, 'public event')} in ${windowText(window).replace(/:.*$/, '')}, too few to draw a rhythm. Repository dates are shown instead.`;
  }

  return {
    unavailable,
    window,
    dots,
    days,
    grid,
    gridMax,
    mix: computeEventMix(events),
    sparse,
    sparseSentence,
    mosaic: computeRepoMosaic(repos),
  };
}

// ---------------------------------------------------------------------------
// Headline (templated from facts only)
// ---------------------------------------------------------------------------

export function buildHeadline(stack: LanguageShare, repos: RepoLite[], now: Date): string {
  if (repos.length === 0) return 'No public repositories to summarize yet.';
  const originals = originalsOf(repos);
  const sentences: string[] = [];

  const named = stack.entries.filter((e) => e.name !== OTHER_NAME);
  const basis = stack.measuredRepos > 0 ? 'by code volume' : 'by repository size (estimated)';
  const lead = named[0];
  const second = named[1];
  if (lead) {
    if (lead.share >= 0.5 || !second) {
      sentences.push(`Mostly ${lead.name}, ${basis}.`);
    } else {
      sentences.push(`${lead.name} and ${second.name} lead, ${basis}.`);
    }
  }

  sentences.push(
    originals.length === 0
      ? 'No original projects yet, only forks.'
      : `${plural(originals.length, 'original project')}.`,
  );

  const newest = sortByPushed(originals)[0];
  if (newest) sentences.push(`Last push ${formatAgo(daysAgo(newest.pushedAt, now))}.`);

  return sentences.join(' ');
}

// ---------------------------------------------------------------------------
// Build facts and coach notes
// ---------------------------------------------------------------------------

export function buildFacts(input: {
  window: EventWindow;
  scope: RepoScope;
  stack: ThenVsNow;
  readmesLoaded: number;
  stats: ModelInput['stats'];
  rateLimit: ModelInput['rateLimit'];
  partial: ModelInput['partial'];
}): BuildFacts {
  const { window, scope, stack, readmesLoaded, stats, rateLimit, partial } = input;
  const truncationNote = scope.truncated
    ? `This account has ${scope.publicRepos} public repositories; only the 100 most recently pushed were analyzed.`
    : null;

  const estimates: string[] = [];
  if (stack.all.estimatedRepos > 0) {
    estimates.push(
      `${plural(stack.all.estimatedRepos, 'repository', 'repositories')} estimated from primary language and repository size, not measured bytes.`,
    );
  }
  if (stack.recent.estimatedRepos > 0 && stack.recent.estimatedRepos !== stack.all.estimatedRepos) {
    estimates.push(
      `${plural(stack.recent.estimatedRepos, 'recently pushed repository', 'recently pushed repositories')} estimated the same way.`,
    );
  }

  const lines: string[] = [
    `Events: ${windowText(window)}`,
    `Repositories analyzed: ${scope.analyzed} owned (${scope.originals} original, ${plural(scope.forks, 'fork')} excluded from stack, freshness, follow-through and featured work).`,
  ];
  if (truncationNote) lines.push(truncationNote);
  lines.push(
    `Languages: measured by bytes for ${plural(stack.all.measuredRepos, 'repository', 'repositories')}` +
      (stack.all.estimatedRepos > 0 ? `, estimated for ${stack.all.estimatedRepos}.` : '.'),
  );
  lines.push(`READMEs read: ${readmesLoaded}.`);
  lines.push(
    `Requests: ${stats.made} made, ${stats.cacheHits} served from cache` +
      (rateLimit.remaining !== null
        ? `, ${rateLimit.remaining}${rateLimit.limit !== null ? ` of ${rateLimit.limit}` : ''} remaining this hour.`
        : '.'),
  );
  if (partial) lines.push(partial.message);

  return {
    eventWindow: window,
    eventWindowText: windowText(window),
    reposAnalyzed: scope.analyzed,
    publicRepos: scope.publicRepos,
    truncated: scope.truncated,
    truncationNote,
    languagesMeasuredRepos: stack.all.measuredRepos,
    languagesEstimatedRepos: stack.all.estimatedRepos,
    readmesLoaded,
    requestsMade: stats.made,
    cacheHits: stats.cacheHits,
    requestsRemaining: rateLimit.remaining,
    rateLimitResetAt: rateLimit.resetAt,
    authenticated: rateLimit.authenticated,
    estimates,
    lines,
  };
}

export function buildCoachNotes(input: {
  repos: RepoLite[];
  selectedWork: SelectedWorkItem[];
  readmes: Record<string, string | null>;
  rhythm: Rhythm;
  scope: RepoScope;
  partial: ModelInput['partial'];
}): CoachNote[] {
  const { repos, selectedWork, readmes, rhythm, scope, partial } = input;
  const notes: CoachNote[] = [];

  for (const item of selectedWork) {
    const r = item.repo;
    if (!r.description?.trim()) {
      notes.push({
        kind: 'description',
        repo: r.name,
        message: `${r.name} is featured but has no description on GitHub; the card uses ${item.summarySource === 'readme' ? 'the README' : 'a language and size line'} instead.`,
      });
    }
    if (Object.prototype.hasOwnProperty.call(readmes, r.fullName) && readmes[r.fullName] === null) {
      notes.push({ kind: 'readme', repo: r.name, message: `${r.name} is featured but has no README.` });
    }
    if (r.topics.length === 0) {
      notes.push({ kind: 'topics', repo: r.name, message: `${r.name} has no topics, which makes it harder to scan.` });
    }
    if (!r.license) {
      notes.push({ kind: 'license', repo: r.name, message: `${r.name} has no license.` });
    }
  }

  const candidates = repos.filter(isFeatureCandidate);
  const undescribed = candidates.filter((r) => !r.description?.trim()).length;
  if (undescribed > 0) {
    notes.push({
      kind: 'description',
      repo: null,
      message: `${undescribed} of ${plural(candidates.length, 'original repository', 'original repositories')} have no description.`,
    });
  }

  if (scope.truncated) {
    notes.push({
      kind: 'truncated',
      repo: null,
      message: `Only the 100 most recently pushed of ${scope.publicRepos} public repositories were analyzed.`,
    });
  }
  if (rhythm.sparse && !rhythm.unavailable) {
    notes.push({
      kind: 'sparse',
      repo: null,
      message: 'Fewer than 10 public events were returned, so the rhythm chart is replaced by a repository mosaic.',
    });
  }
  if (partial) {
    notes.push({ kind: 'rate-limit', repo: null, message: partial.message });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Whole-model assembly
// ---------------------------------------------------------------------------

function buildProfile(user: ModelInput['user'], now: Date): Profile {
  const created = toMs(user.created_at);
  return {
    login: user.login,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
    location: user.location,
    company: user.company,
    blog: user.blog && user.blog.trim() ? user.blog.trim() : null,
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
    createdAt: user.created_at,
    accountAgeYears: created === null ? 0 : Math.max(0, Math.floor((now.getTime() - created) / (365.25 * DAY_MS))),
  };
}

/** Pure: turns raw payloads into the full ResumeModel. Called for each phase. */
export function buildResumeModel(input: ModelInput): ResumeModel {
  const { user, now } = input;
  const repos = sortByPushed((input.repos ?? []).slice(0, MAX_REPOS).map(toRepoLite));
  const originals = originalsOf(repos);
  const truncated = (input.repos?.length ?? 0) >= MAX_REPOS && user.public_repos > MAX_REPOS;

  const scope: RepoScope = {
    publicRepos: user.public_repos,
    analyzed: repos.length,
    originals: originals.length,
    forks: repos.length - originals.length,
    archived: repos.filter((r) => r.archived).length,
    truncated,
  };

  const stack = computeThenVsNow(repos, input.languages, now);
  const selectedWork = selectWork(repos, now, input.readmes);
  const rhythm = computeRhythm(input.events, repos, input.events === null);
  const readmesLoaded = Object.keys(input.readmes).filter((k) => input.readmes[k] !== null).length;

  return {
    username: user.login,
    generatedAt: now.toISOString(),
    phase: input.phase,
    profile: buildProfile(user, now),
    headline: buildHeadline(stack.all, repos, now),
    scope,
    repos,
    stack,
    selectedWork,
    skyline: buildSkyline(repos, now),
    signals: computeSignals(repos, input.events, user.login, now),
    rhythm,
    facts: buildFacts({
      window: rhythm.window,
      scope,
      stack,
      readmesLoaded,
      stats: input.stats,
      rateLimit: input.rateLimit,
      partial: input.partial,
    }),
    coach: buildCoachNotes({
      repos,
      selectedWork,
      readmes: input.readmes,
      rhythm,
      scope,
      partial: input.partial,
    }),
    partial: input.partial,
    rateLimit: input.rateLimit,
    log: input.log,
  };
}
