const RESERVED_SEGMENTS = new Set([
  'settings',
  'login',
  'signup',
  'explore',
  'topics',
  'marketplace',
  'features',
  'pricing',
  'about',
  'notifications',
  'search',
  'orgs',
  'organizations',
  'apps',
  'new',
  'pull',
  'issues',
  'sponsors',
  'collections',
  'events',
  'customer-stories',
  'enterprise',
  'security',
  'team',
  'account',
  'sessions',
  'join',
  'codespaces',
  'trending',
  'readme',
  'site',
  'users',
]);

const GITHUB_WEB = /^(?:https?:\/\/)?(?:www\.)?github\.com(?:[/?#]|$)/i;
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function normalizeUsername(segment: string): string | null {
  let name = segment;
  try {
    name = decodeURIComponent(segment);
  } catch {
    return null;
  }

  name = name.replace(/\.git$/i, '');
  if (!USERNAME.test(name) || RESERVED_SEGMENTS.has(name.toLowerCase())) {
    return null;
  }
  return name;
}

function usernameFromGitHubUrl(value: string): string | null {
  const urlString = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'github.com') return null;

  const segment = url.pathname.split('/').filter(Boolean)[0];
  if (!segment) return null;
  return normalizeUsername(segment);
}

/**
 * Extracts a GitHub login from a username, @mention, profile URL, or
 * git@github.com:user/repo.git remote. Returns null when the input is empty
 * or no user login can be extracted.
 */
export function parseGitHubUsername(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const ssh = raw.match(/^git@github\.com:([^/\s?#]+)/i);
  if (ssh) return normalizeUsername(ssh[1]);

  const sshUrl = raw.match(/^ssh:\/\/git@github\.com\/([^/\s?#]+)/i);
  if (sshUrl) return normalizeUsername(sshUrl[1]);

  const value = raw.replace(/^@+/, '');

  if (GITHUB_WEB.test(value)) {
    return usernameFromGitHubUrl(value);
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(value) || /github\.com/i.test(value) || /\s/.test(value)) {
    return null;
  }

  const plain = value.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  if (!plain || plain.includes('/')) return null;
  return normalizeUsername(plain);
}
