/**
 * Shared types for the GitHub resume data layer.
 *
 * Raw* types mirror the subset of the GitHub REST v3 payloads we read.
 * Everything else is the normalized model the UI renders.
 */

// ---------------------------------------------------------------------------
// Raw GitHub payloads (only the fields we use)
// ---------------------------------------------------------------------------

export interface RawUser {
  login: string;
  id: number;
  type: string; // "User" | "Organization" | "Bot"
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  location: string | null;
  company: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
}

export interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  license: { spdx_id: string | null; name: string } | null;
  size: number; // KB
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  fork: boolean;
  archived: boolean;
  created_at: string;
  pushed_at: string | null;
  updated_at: string;
}

export interface RawEvent {
  id: string;
  type: string | null;
  created_at: string | null;
  repo: { id: number; name: string; url: string };
}

export interface RawReadme {
  content?: string;
  encoding?: string;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error';

export interface BuildLogEntry {
  /** ISO timestamp */
  at: string;
  /** Milliseconds since the logger was created */
  elapsedMs: number;
  level: LogLevel;
  /** Short stage name, e.g. "user", "repos", "languages" */
  step: string;
  message: string;
  /** Small, non-sensitive detail (never contains tokens) */
  data?: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Errors and rate limits
// ---------------------------------------------------------------------------

export type ResumeErrorKind =
  | 'invalid-username'
  | 'not-found'
  | 'organization'
  | 'rate-limit'
  | 'forbidden'
  | 'network'
  | 'unknown';

export interface RateLimitInfo {
  /** Value of X-RateLimit-Remaining from the most recent response, if seen */
  remaining: number | null;
  /** Value of X-RateLimit-Limit, if seen */
  limit: number | null;
  /** X-RateLimit-Reset as ISO time, if seen */
  resetAt: string | null;
  /** True when a token was sent (limit is 5000/h rather than 60/h) */
  authenticated: boolean;
}

export interface PartialInfo {
  reason: 'rate-limit' | 'error';
  /** Core / enrichment parts that did not load */
  missing: Array<'repos' | 'events' | 'languages' | 'readmes'>;
  /** When the rate limit resets (ISO), if known */
  resetAt: string | null;
  /** Human-readable, specific sentence for the Coach / build log */
  message: string;
}

// ---------------------------------------------------------------------------
// Normalized repo
// ---------------------------------------------------------------------------

export interface RepoLite {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  license: string | null;
  /** Repository size in KB, as reported by GitHub */
  sizeKb: number;
  stars: number;
  forks: number;
  /** watchers_count (GitHub mirrors stargazers here; kept for the ranking formula) */
  watchers: number;
  isFork: boolean;
  archived: boolean;
  createdAt: string;
  /** pushed_at, falling back to created_at for empty repos */
  pushedAt: string;
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

export interface LanguageEntry {
  name: string;
  color: string;
  bytes: number;
  /** Bytes from /languages payloads */
  measuredBytes: number;
  /** Bytes estimated from repo size + primary language */
  estimatedBytes: number;
  /** 0..1 share of total bytes */
  share: number;
  /** True if any part of this entry is estimated (UI hatches the estimated slice) */
  estimated: boolean;
}

export interface LanguageShare {
  entries: LanguageEntry[];
  totalBytes: number;
  /** Repos whose bytes came from /languages */
  measuredRepos: number;
  /** Repos estimated from primary language + size */
  estimatedRepos: number;
  /** Repos with neither language data nor primary language */
  unclassifiedRepos: number;
  hasEstimate: boolean;
}

export interface ThenVsNow {
  /** Mix across all analyzed original repos */
  all: LanguageShare;
  /** Mix across originals pushed within windowDays */
  recent: LanguageShare;
  windowDays: number;
  recentRepoCount: number;
  allRepoCount: number;
  /** false when no original repo was pushed in the window */
  enough: boolean;
  /** Leading language overall vs recently (null when unknown) */
  leaderAll: string | null;
  leaderRecent: string | null;
  leaderChanged: boolean;
}

// ---------------------------------------------------------------------------
// Selected work
// ---------------------------------------------------------------------------

export interface RankParts {
  recency: number;
  substance: number;
  legibility: number;
  community: number;
}

export type DescriptionSource = 'description' | 'readme' | 'fallback';

export interface SelectedWorkItem {
  repo: RepoLite;
  /** 0..1 weighted score */
  score: number;
  parts: RankParts;
  /** Plain-language reasons this repo was chosen */
  reasons: string[];
  /** Card line; never "No description provided" */
  summary: string;
  summarySource: DescriptionSource;
  languageColor: string;
}

export interface SkylineTower {
  name: string;
  fullName: string;
  htmlUrl: string;
  language: string | null;
  color: string;
  sizeKb: number;
  /** log1p(size) normalized 0..1 across the towers */
  height: number;
  /** 0..1, 1 = pushed today, half-life 180 days */
  recency: number;
  createdAt: string;
  pushedAt: string;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

interface SignalBase {
  /** False means the UI should say "not enough public data" */
  enough: boolean;
  /** Plain one-line caption */
  caption: string;
  /** Text for the "How?" disclosure */
  how: string;
}

export interface LastShippedSignal extends SignalBase {
  /** Days since newest push to an original repo; null when no originals */
  daysSincePush: number | null;
  newestRepo: string | null;
  /** Originals pushed in the last 90 days */
  movedIn90Days: number;
  originals: number;
}

export interface FollowThroughSignal extends SignalBase {
  /** 0..1 share of eligible originals that spanned >= 7 days */
  share: number | null;
  /** Eligible originals (older than 30 days) */
  sample: number;
  sustained: number;
  minSample: number;
}

export interface ActiveDaysSignal extends SignalBase {
  /** Distinct UTC days with at least one public event */
  days: number;
  /** Length of the real event window in days (inclusive), null if no events */
  windowDays: number | null;
  events: number;
}

export interface OutsideReachSignal extends SignalBase {
  /** Contribution events in repos the user does not own */
  events: number;
  /** Contribution events considered (stars excluded) */
  sample: number;
  share: number | null;
  distinctRepos: number;
}

export interface OriginalShareSignal extends SignalBase {
  originals: number;
  forks: number;
  /** originals / (originals + forks), null if no repos */
  share: number | null;
}

export interface YearsWithProjectsSignal extends SignalBase {
  years: number[];
  count: number;
}

export interface Signals {
  lastShipped: LastShippedSignal;
  followThrough: FollowThroughSignal;
  activeDays: ActiveDaysSignal;
  outsideReach: OutsideReachSignal;
  originalShare: OriginalShareSignal;
  yearsWithProjects: YearsWithProjectsSignal;
}

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------

export interface EventDot {
  /** ISO timestamp */
  at: string;
  /** UTC date key YYYY-MM-DD */
  day: string;
  type: string;
  repo: string;
}

export interface RhythmDay {
  /** UTC date key YYYY-MM-DD; only days that have events are present */
  day: string;
  count: number;
  /** True when the previous UTC calendar day is also in the list (draw a join) */
  joinedToPrevious: boolean;
}

export interface EventMixSegment {
  key: string;
  label: string;
  count: number;
}

export interface MosaicCell {
  year: number;
  /** 0 = January */
  month: number;
  created: number;
  pushed: number;
}

export interface RepoMosaic {
  /** Continuous range of years, oldest first */
  years: number[];
  /** Only months with activity are listed; absent months are empty */
  cells: MosaicCell[];
}

export interface EventWindow {
  /** Oldest event, ISO; null if no events */
  from: string | null;
  /** Newest event, ISO; null if no events */
  to: string | null;
  /** Events in the fetched page */
  count: number;
  /** True when the page was full (100), so older events exist but were not fetched */
  capped: boolean;
}

export interface Rhythm {
  /** True when the events request failed (rate limit etc.): show nothing, not "quiet" */
  unavailable: boolean;
  window: EventWindow;
  /** One entry per event, oldest first */
  dots: EventDot[];
  /** One entry per active UTC day, oldest first. Zero days are never present. */
  days: RhythmDay[];
  /** grid[weekday][hour], weekday 0 = Sunday (getUTCDay), hour 0..23, UTC */
  grid: number[][];
  gridMax: number;
  mix: EventMixSegment[];
  /** Fewer than MIN_EVENTS_FOR_RHYTHM events: show a sentence + mosaic, no chart */
  sparse: boolean;
  sparseSentence: string | null;
  mosaic: RepoMosaic;
}

// ---------------------------------------------------------------------------
// Build facts, coach, model
// ---------------------------------------------------------------------------

export interface BuildFacts {
  eventWindow: EventWindow;
  eventWindowText: string;
  reposAnalyzed: number;
  publicRepos: number;
  truncated: boolean;
  /** Set when more than 100 owned repos exist */
  truncationNote: string | null;
  languagesMeasuredRepos: number;
  languagesEstimatedRepos: number;
  readmesLoaded: number;
  requestsMade: number;
  cacheHits: number;
  requestsRemaining: number | null;
  rateLimitResetAt: string | null;
  authenticated: boolean;
  estimates: string[];
  /** Ready-to-print lines for the Method footer */
  lines: string[];
}

export interface CoachNote {
  kind: 'description' | 'readme' | 'topics' | 'license' | 'rate-limit' | 'truncated' | 'sparse';
  repo: string | null;
  message: string;
}

export interface Profile {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string;
  htmlUrl: string;
  location: string | null;
  company: string | null;
  blog: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
  accountAgeYears: number;
}

export interface RepoScope {
  /** Total public owned repos reported by GitHub */
  publicRepos: number;
  /** Repos actually analyzed (max 100, most recently pushed) */
  analyzed: number;
  originals: number;
  forks: number;
  archived: number;
  truncated: boolean;
}

export type ModelPhase = 'core' | 'complete';

export interface ResumeModel {
  username: string;
  /** ISO time the model was built */
  generatedAt: string;
  /** "core" = user + repos + events only; "complete" = after languages and READMEs */
  phase: ModelPhase;
  profile: Profile;
  headline: string;
  scope: RepoScope;
  /** Analyzed repos, most recently pushed first (forks included, flagged) */
  repos: RepoLite[];
  stack: ThenVsNow;
  selectedWork: SelectedWorkItem[];
  skyline: SkylineTower[];
  signals: Signals;
  rhythm: Rhythm;
  facts: BuildFacts;
  coach: CoachNote[];
  /** Set when a rate limit or error cut the model short */
  partial: PartialInfo | null;
  rateLimit: RateLimitInfo;
  /** Structured log entries (same stream that goes to the console) */
  log: BuildLogEntry[];
}

// ---------------------------------------------------------------------------
// Analysis input
// ---------------------------------------------------------------------------

export interface RequestStats {
  made: number;
  cacheHits: number;
}

export interface ModelInput {
  user: RawUser;
  /** Raw repos from the list call; null if that call failed */
  repos: RawRepo[] | null;
  /** Raw events; null if that call failed */
  events: RawEvent[] | null;
  /** Language byte maps keyed by full_name */
  languages: Record<string, Record<string, number>>;
  /** README excerpts keyed by full_name; null = README missing (404) */
  readmes: Record<string, string | null>;
  phase: ModelPhase;
  now: Date;
  partial: PartialInfo | null;
  rateLimit: RateLimitInfo;
  stats: RequestStats;
  log: BuildLogEntry[];
}
