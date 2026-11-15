import { STAT_VALUE_DIVISOR } from './constants';
import { STAT_ORDER } from './types';
import type { Log, MoveKind, StatId } from './types';

export type StatXp = Partial<Record<StatId, number>>;

/**
 * Splits xp evenly across targets. Each gets floor(xp / n).
 * The remainder goes one point each to the first targets in STAT_ORDER.
 * The parts always sum to xp.
 */
export function splitEvenly(xp: number, targets: readonly StatId[]): StatXp {
  const ordered = STAT_ORDER.filter((s) => targets.includes(s));
  const n = ordered.length;
  if (n === 0 || xp <= 0) return {};
  const share = Math.floor(xp / n);
  const remainder = xp - share * n;
  const out: StatXp = {};
  ordered.forEach((stat, i) => {
    out[stat] = share + (i < remainder ? 1 : 0);
  });
  return out;
}

function moveTargets(kind: MoveKind): readonly StatId[] {
  switch (kind) {
    case 'cardio':
      return ['endurance'];
    case 'strength':
      return ['strength'];
    case 'mobility':
      return ['agility'];
    case 'sport':
      return ['endurance', 'agility'];
  }
}

export function routeTargets(log: Log): readonly StatId[] {
  switch (log.type) {
    case 'move':
      return moveTargets(log.kind);
    case 'eat':
      return ['vitality'];
    case 'rest':
      return ['recovery'];
  }
}

export function statsForLog(log: Log, xp: number): StatXp {
  return splitEvenly(xp, routeTargets(log));
}

export function statValue(statXp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, statXp) / STAT_VALUE_DIVISOR));
}
