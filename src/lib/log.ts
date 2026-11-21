/**
 * Structured build logger.
 *
 * Every step is written to the console AND kept in memory so the model can
 * return the entries for the on-page build log. One logger per resume build.
 * Never pass tokens or Authorization headers to this logger.
 */

import type { BuildLogEntry, LogLevel } from './types';

export type LogData = Record<string, string | number | boolean | null>;

export interface BuildLogger {
  info(step: string, message: string, data?: LogData): void;
  warn(step: string, message: string, data?: LogData): void;
  error(step: string, message: string, data?: LogData): void;
  /** Snapshot copy of the entries recorded so far */
  entries(): BuildLogEntry[];
  /** Optional subscriber (e.g. for a live narrated progress rail) */
  subscribe(listener: (entry: BuildLogEntry) => void): () => void;
}

const PREFIX = '[github-resume]';

export function createLogger(options: { console?: boolean } = {}): BuildLogger {
  const useConsole = options.console ?? true;
  const started = Date.now();
  const list: BuildLogEntry[] = [];
  const listeners = new Set<(entry: BuildLogEntry) => void>();

  const write = (level: LogLevel, step: string, message: string, data?: LogData): void => {
    const entry: BuildLogEntry = {
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      level,
      step,
      message,
      ...(data ? { data } : {}),
    };
    list.push(entry);
    listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // A broken subscriber must not break the build.
      }
    });
    if (useConsole && typeof console !== 'undefined') {
      const line = `${PREFIX} ${step}: ${message}`;
      const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
      if (data) method(line, data);
      else method(line);
    }
  };

  return {
    info: (step, message, data) => write('info', step, message, data),
    warn: (step, message, data) => write('warn', step, message, data),
    error: (step, message, data) => write('error', step, message, data),
    entries: () => list.slice(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
