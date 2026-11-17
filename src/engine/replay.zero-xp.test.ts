import { describe, expect, it, vi } from 'vitest';

// With valid logs a day never totals 0 XP: the first log of a day always earns at least 1.
// The coach's welcome_back rule reads the keys of xpByDate as the active dates, so this file
// forces every log to award 0 base XP and checks the key is still written.
vi.mock('./xp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./xp')>();
  return { ...actual, baseXp: () => 0 };
});

const { replayDetailed } = await import('./replay');

describe('xpByDate keys', () => {
  it('has a key with value 0 for a day whose logs earn no XP', () => {
    // 5 minutes of cardio at 21:40 completes none of the seven quests.
    const log = {
      id: 'a',
      type: 'move' as const,
      kind: 'cardio' as const,
      minutes: 5,
      intensity: 'light' as const,
      loggedAt: Date.UTC(2026, 10, 10, 21, 40),
      localDate: '2026-11-10',
      localMinutes: 21 * 60 + 40,
    };
    const d = replayDetailed([log], { localDate: '2026-11-14' });
    expect(d.logXpByDate['2026-11-10']).toBe(0);
    expect(d.bonusXpByDate['2026-11-10']).toBe(0);
    expect(d.state.xpByDate).toEqual({ '2026-11-10': 0 });
  });
});
