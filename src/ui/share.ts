import { useCallback, useEffect, useState } from 'react';
import { formatAgo, formatSize } from '../lib/analyze';
import type { ResumeModel } from '../lib/types';

const PIN_KEY = 'pin';

export function readUserParam(): string | null {
  const v = new URLSearchParams(window.location.search).get('u');
  return v && v.trim() ? v.trim() : null;
}

export function readPins(): string[] {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const raw = params.get(PIN_KEY);
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function writePins(pins: string[]): void {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (pins.length === 0) params.delete(PIN_KEY);
  else params.set(PIN_KEY, pins.join(','));
  const hash = params.toString().replace(/%2C/gi, ',');
  const url = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  window.history.replaceState(window.history.state, '', url);
}

/** Pinned repo names, kept in the URL hash (`#pin=a,b`) so a shared link carries them. */
export function usePins(): { pins: string[]; toggle: (name: string) => void } {
  const [pins, setPins] = useState<string[]>(() => readPins());
  useEffect(() => {
    const onHash = (): void => setPins(readPins());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const toggle = useCallback((name: string) => {
    setPins((prev) => {
      const next = prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name].slice(-8);
      writePins(next);
      return next;
    });
  }, []);
  return { pins, toggle };
}

export function buildShareUrl(login: string, pins: string[]): string {
  const url = new URL(window.location.href);
  url.search = `?u=${encodeURIComponent(login)}`;
  url.hash = pins.length ? `pin=${pins.map(encodeURIComponent).join(',')}` : '';
  return url.toString();
}

export function setUserParam(login: string | null, mode: 'push' | 'replace' = 'push'): void {
  const url = new URL(window.location.href);
  if (login) url.searchParams.set('u', login);
  else url.searchParams.delete('u');
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'push') window.history.pushState({}, '', next);
  else window.history.replaceState({}, '', next);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface MarkdownWork {
  name: string;
  htmlUrl: string;
  summary: string;
  language: string | null;
  sizeKb: number;
}

export function buildMarkdown(model: ResumeModel, work: MarkdownWork[], url: string): string {
  const { profile } = model;
  const lines: string[] = [];
  lines.push(`# ${profile.name ?? profile.login} (@${profile.login})`);
  lines.push('');
  lines.push(model.headline);
  if (profile.bio) {
    lines.push('');
    lines.push(`> ${profile.bio}`);
  }
  lines.push('');
  if (work.length > 0) {
    lines.push('## Selected work');
    lines.push('');
    for (const w of work) {
      const meta = [w.language, formatSize(w.sizeKb)].filter(Boolean).join(' · ');
      lines.push(`- [${w.name}](${w.htmlUrl}): ${w.summary} _(${meta})_`);
    }
    lines.push('');
  }
  const named = model.stack.all.entries.filter((e) => e.name !== 'Other').slice(0, 5);
  if (named.length > 0) {
    const basis = model.stack.all.hasEstimate ? 'by bytes, partly estimated' : 'by bytes';
    lines.push(`## Languages (${basis})`);
    lines.push('');
    lines.push(named.map((e) => `${e.name} ${Math.round(e.share * 100)}%`).join(' · '));
    lines.push('');
  }
  const s = model.signals;
  const signalLines: string[] = [];
  if (s.lastShipped.enough) signalLines.push(`- ${s.lastShipped.caption}`);
  if (s.followThrough.enough) signalLines.push(`- ${s.followThrough.caption}`);
  if (s.activeDays.enough) signalLines.push(`- ${s.activeDays.caption}`);
  if (s.outsideReach.enough) signalLines.push(`- ${s.outsideReach.caption}`);
  if (s.originalShare.enough) signalLines.push(`- ${s.originalShare.caption}`);
  if (signalLines.length > 0) {
    lines.push('## Signals');
    lines.push('');
    lines.push(...signalLines);
    lines.push('');
  }
  lines.push(`_Built from public GitHub data. Events: ${model.facts.eventWindowText}_`);
  lines.push('');
  lines.push(`Resume: ${url}`);
  lines.push(`Profile: ${profile.htmlUrl}`);
  return lines.join('\n');
}

export function describeAgo(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  return formatAgo(Math.max(0, (now - ms) / 86_400_000));
}

export function formatResetTime(resetAt: string | null): string | null {
  if (!resetAt) return null;
  const ms = Date.parse(resetAt);
  if (!Number.isFinite(ms)) return null;
  const clock = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const minutes = Math.max(1, Math.ceil((ms - Date.now()) / 60_000));
  return `${clock} (in about ${minutes} min)`;
}
