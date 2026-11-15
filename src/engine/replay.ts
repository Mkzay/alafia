import { QUEST_BONUS_XP } from './constants';
import { addDays, compareDates } from './dates';
import { levelProgress } from './levels';
import { evaluateQuests, QUEST_DEFINITIONS } from './quests';
import { splitEvenly, statsForLog, statValue } from './stats';
import type { StatXp } from './stats';
import { activeDates, streakAsOf, streakEndingOn } from './streaks';
import { advanceContext, applyCap, applyStreakMultiplier, baseXp, EMPTY_XP_CONTEXT } from './xp';
import { STAT_ORDER } from './types';
import type { CharacterState, Log, StatId, StatState } from './types';

export interface ReplayDetail {
  state: CharacterState;
  /** Log XP per date, after multiplier and cap. Never above the daily cap. */
  logXpByDate: Record<string, number>;
  /** Quest bonus XP per date. */
  bonusXpByDate: Record<string, number>;
}

function compareLogs(a: Log, b: Log): number {
  if (a.loggedAt !== b.loggedAt) return a.loggedAt < b.loggedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function emptyStatXp(): Record<StatId, number> {
  return { strength: 0, endurance: 0, agility: 0, vitality: 0, recovery: 0 };
}

function addStatXp(target: Record<StatId, number>, parts: StatXp): void {
  for (const stat of STAT_ORDER) target[stat] += parts[stat] ?? 0;
}

export function replayDetailed(
  logs: readonly Log[],
  asOf: { localDate: string },
): ReplayDetail {
  const eligible = logs
    .filter((l) => compareDates(l.localDate, asOf.localDate) <= 0)
    .sort(compareLogs);
  const active = activeDates(eligible);

  const byDate = new Map<string, Log[]>();
  for (const log of eligible) {
    const list = byDate.get(log.localDate);
    if (list) list.push(log);
    else byDate.set(log.localDate, [log]);
  }

  const statXp = emptyStatXp();
  const logXpByDate: Record<string, number> = {};
  const bonusXpByDate: Record<string, number> = {};
  const xpByDate: Record<string, number> = {};

  for (const date of [...byDate.keys()].sort(compareDates)) {
    const dayLogs = byDate.get(date) ?? [];
    const streakBefore = streakEndingOn(active, addDays(date, -1));
    let ctx = EMPTY_XP_CONTEXT;
    let used = 0;

    for (const log of dayLogs) {
      const boosted = applyStreakMultiplier(baseXp(log, ctx), streakBefore);
      const awarded = applyCap(boosted, used);
      used += awarded;
      ctx = advanceContext(ctx, log);
      addStatXp(statXp, statsForLog(log, awarded));
    }

    let bonus = 0;
    for (const quest of evaluateQuests(date, dayLogs)) {
      if (!quest.bonusAwarded) continue;
      bonus += QUEST_BONUS_XP;
      addStatXp(statXp, splitEvenly(QUEST_BONUS_XP, QUEST_DEFINITIONS[quest.id].related));
    }

    logXpByDate[date] = used;
    bonusXpByDate[date] = bonus;
    xpByDate[date] = used + bonus;
  }

  const totalXp = Object.values(xpByDate).reduce((a, b) => a + b, 0);
  const progress = levelProgress(totalXp);
  const stats = Object.fromEntries(
    STAT_ORDER.map((s): [StatId, StatState] => [s, { xp: statXp[s], value: statValue(statXp[s]) }]),
  ) as Record<StatId, StatState>;
  const { streak, atRisk } = streakAsOf(active, asOf.localDate);

  return {
    state: {
      totalXp,
      level: progress.level,
      xpIntoLevel: progress.xpIntoLevel,
      xpForNext: progress.xpForNext,
      stats,
      streak,
      streakAtRisk: atRisk,
      xpByDate,
      quests: evaluateQuests(asOf.localDate, byDate.get(asOf.localDate) ?? []),
    },
    logXpByDate,
    bonusXpByDate,
  };
}

/** Logs in, CharacterState out. The only entry point the app needs. */
export function replay(logs: readonly Log[], asOf: { localDate: string }): CharacterState {
  return replayDetailed(logs, asOf).state;
}
