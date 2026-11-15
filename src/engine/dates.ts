/**
 * Pure date helpers for 'YYYY-MM-DD' strings.
 * Uses Date.UTC arithmetic only. Never reads the clock.
 * Callers must pass valid calendar dates.
 */

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function addDays(date: string, days: number): string {
  const t = new Date(toUtcMs(date) + days * DAY_MS);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1, 2)}-${pad(t.getUTCDate(), 2)}`;
}

/** Negative if a is before b, 0 if equal, positive if a is after b. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
