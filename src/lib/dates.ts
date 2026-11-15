export interface LocalParts {
  /** 'YYYY-MM-DD' in the device time zone. */
  localDate: string;
  /** Minutes since local midnight, 0 to 1439. */
  localMinutes: number;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function localParts(date: Date): LocalParts {
  return {
    localDate: `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`,
    localMinutes: date.getHours() * 60 + date.getMinutes(),
  };
}

/** Milliseconds from `date` to the next local midnight. Always above 0. */
export function msUntilNextLocalMidnight(date: Date): number {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - date.getTime();
}
