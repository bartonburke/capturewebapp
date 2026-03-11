/**
 * Debug logging utility.
 *
 * In development, logs are printed via console.debug (filterable in DevTools).
 * In production, they are suppressed entirely.
 *
 * console.warn and console.error should still be used directly for actual problems.
 */

const isDev = process.env.NODE_ENV === 'development';

export function debug(tag: string, ...args: unknown[]): void {
  if (isDev) {
    console.debug(`[${tag}]`, ...args);
  }
}
