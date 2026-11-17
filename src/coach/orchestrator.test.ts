import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCoachLine } from './orchestrator';
import type { GenerateCoachLineOptions } from './orchestrator';
import { FALLBACK_LINE, renderTemplate, TEMPLATE_LINES } from './templates';
import type { CoachInput, CoachProvider } from './types';

const input: CoachInput = {
  event: 'move',
  xpGained: 45,
  level: 2,
  streak: 1,
  topStat: 'endurance',
  timeBucket: 'morning',
  tone: 'warm',
};
const templateLines = TEMPLATE_LINES.move.map((l) => renderTemplate(l, input));

const provider = (name: string, generate: CoachProvider['generate']): CoachProvider => ({ name, generate: vi.fn(generate) });
const ok = (name: string, text: string) => provider(name, async () => text);
/** Never settles and ignores its signal. */
const hang = (name: string) => provider(name, () => new Promise<string>(() => undefined));
/** Resolves after ms, and stops cleanly when aborted. */
const slow = (name: string, text: string, ms: number) =>
  provider(
    name,
    (_i, { signal }) =>
      new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => resolve(text), ms);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      }),
  );

function options(patch: Partial<GenerateCoachLineOptions> = {}): GenerateCoachLineOptions {
  return {
    input,
    providers: [ok('groq', 'Nice walk today.')],
    online: true,
    aiEnabled: true,
    spendAiCall: vi.fn(async () => true),
    seed: 'log-1',
    ...patch,
  };
}

async function run(patch: Partial<GenerateCoachLineOptions> = {}, advanceMs = 5000) {
  const opts = options(patch);
  const promise = generateCoachLine(opts);
  await vi.advanceTimersByTimeAsync(advanceMs);
  const out = await promise;
  return { out, opts };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe('gates', () => {
  it.each([
    ['offline', { online: false }],
    ['AI off', { aiEnabled: false }],
    ['no providers', { providers: [] }],
  ] as const)('%s returns a template at once with no spend, call or timer', async (_name, patch) => {
    const opts = options(patch);
    const promise = generateCoachLine(opts);
    expect(vi.getTimerCount()).toBe(0);
    const out = await promise;
    expect(out.source).toBe('template');
    expect(templateLines).toContain(out.text);
    expect(opts.spendAiCall).not.toHaveBeenCalled();
    for (const p of opts.providers) expect(p.generate).not.toHaveBeenCalled();
  });

  it('invalid or extra input returns FALLBACK_LINE without spending', async () => {
    for (const bad of [{ ...input, name: 'Ada' }, { ...input, xpGained: 361 }, 'nope', undefined]) {
      const { out, opts } = await run({ input: bad });
      expect(out).toEqual({ text: FALLBACK_LINE, source: 'template' });
      expect(opts.spendAiCall).not.toHaveBeenCalled();
      expect(opts.providers[0].generate).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['returns false', async () => false],
    ['throws', () => {
      throw new Error('db');
    }],
    ['rejects', async () => {
      throw new Error('db');
    }],
  ])('budget spend that %s gives a template and no provider call', async (_n, spend) => {
    const { out, opts } = await run({ spendAiCall: spend as () => Promise<boolean> });
    expect(out.source).toBe('template');
    expect(opts.providers[0].generate).not.toHaveBeenCalled();
  });

  it('a spend that never settles ends at the 4 second total', async () => {
    const opts = options({ spendAiCall: () => new Promise<boolean>(() => undefined) });
    const promise = generateCoachLine(opts);
    await vi.advanceTimersByTimeAsync(3999);
    let done = false;
    void promise.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await promise).source).toBe('template');
    expect(opts.providers[0].generate).not.toHaveBeenCalled();
  });

  it('spends exactly once per run', async () => {
    const { opts } = await run({ providers: [hang('a'), ok('b', 'Nice one.')] });
    expect(opts.spendAiCall).toHaveBeenCalledTimes(1);
  });
});

describe('success', () => {
  it('returns the provider line with its name', async () => {
    const { out } = await run();
    expect(out).toEqual({ text: 'Nice walk today.', source: 'ai', provider: 'groq' });
  });

  it('returns the cleaned text', async () => {
    const { out } = await run({ providers: [ok('groq', '  **Great** walk!  ')] });
    expect(out.text).toBe('Great walk!');
  });

  it('normalizes dashes before validation', async () => {
    const { out } = await run({ providers: [ok('groq', 'Great walk \u2014 rest well. Try 3\u20135 minutes.')] });
    expect(out).toEqual({ text: 'Great walk, rest well. Try 3-5 minutes.', source: 'ai', provider: 'groq' });
  });

  it('passes only the seven CoachInput fields, frozen', async () => {
    let seen: unknown;
    const spy = provider('groq', async (i) => {
      seen = i;
      return 'Nice.';
    });
    await run({ providers: [spy] });
    expect(seen).toEqual(input);
    expect(Object.keys(seen as object).sort()).toEqual(Object.keys(input).sort());
    expect(Object.isFrozen(seen)).toBe(true);
  });
});

describe('failures move to the next provider', () => {
  it.each([
    ['throws synchronously', () => {
      throw new Error('x');
    }],
    ['rejects', async () => {
      throw new Error('x');
    }],
    ['returns a number', async () => 42 as unknown as string],
    ['returns undefined', async () => undefined as unknown as string],
    ['returns a banned line', async () => 'Great for weight loss!'],
    ['returns too many sentences', async () => 'One. Two. Three.'],
    ['returns a long line', async () => 'a'.repeat(241)],
    ['returns a URL', async () => 'See www.example.com now.'],
    ['returns only dashes', async () => '\u2014 \u2014'],
  ])('when the first %s', async (_n, generate) => {
    const second = ok('gemini', 'Good move.');
    const { out } = await run({ providers: [provider('groq', generate as CoachProvider['generate']), second] });
    expect(out).toEqual({ text: 'Good move.', source: 'ai', provider: 'gemini' });
  });

  it('falls back to a template when every provider fails', async () => {
    const { out } = await run({
      providers: [provider('a', async () => {
        throw new Error('secret key sk-123');
      }), ok('b', 'You must stop.'), hang('c')],
    });
    expect(out.source).toBe('template');
    expect(out.provider).toBeUndefined();
    expect(templateLines).toContain(out.text);
    expect(out.text).not.toContain('secret');
  });

  it('survives a provider whose generate getter throws', async () => {
    const evil = {
      name: 'evil',
      get generate(): CoachProvider['generate'] {
        throw new Error('boom');
      },
    } as CoachProvider;
    const { out } = await run({ providers: [evil, ok('b', 'Nice one.')] });
    expect(out.provider).toBe('b');
  });
});

describe('timing', () => {
  it('aborts a provider at 3 seconds and tries the next with the time left', async () => {
    let firstAbortAt = -1;
    let secondAbortAt = -1;
    const start = Date.now();
    const first = provider('a', (_i, { signal }) => {
      signal.addEventListener('abort', () => (firstAbortAt = Date.now() - start));
      return new Promise<string>(() => undefined);
    });
    const second = provider('b', (_i, { signal }) => {
      signal.addEventListener('abort', () => (secondAbortAt = Date.now() - start));
      return new Promise<string>(() => undefined);
    });
    const { out } = await run({ providers: [first, second] });
    expect(firstAbortAt).toBe(3000);
    expect(secondAbortAt).toBe(4000);
    expect(second.generate).toHaveBeenCalledTimes(1);
    expect(out.source).toBe('template');
  });

  it('a second provider can still win inside the time left', async () => {
    const { out } = await run({ providers: [hang('a'), slow('b', 'Steady work.', 500)] });
    expect(out).toEqual({ text: 'Steady work.', source: 'ai', provider: 'b' });
  });

  it('a second provider slower than the time left loses', async () => {
    const { out } = await run({ providers: [hang('a'), slow('b', 'Too late.', 1500)] });
    expect(out.source).toBe('template');
  });

  it('counts the budget spend inside the 4 seconds', async () => {
    let abortAt = -1;
    const start = Date.now();
    const spendAiCall = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2500));
    const p = provider('a', (_i, { signal }) => {
      signal.addEventListener('abort', () => (abortAt = Date.now() - start));
      return new Promise<string>(() => undefined);
    });
    const { out } = await run({ spendAiCall, providers: [p] });
    expect(abortAt).toBe(4000);
    expect(out.source).toBe('template');
  });

  it('ignores a result that arrives after the abort', async () => {
    const late = provider('a', () => new Promise<string>((resolve) => setTimeout(() => resolve('Late line.'), 5000)));
    const { out } = await run({ providers: [late] }, 6000);
    expect(out.source).toBe('template');
    expect(out.text).not.toBe('Late line.');
  });

  it('resolves well before the total when a provider answers fast', async () => {
    const opts = options({ providers: [slow('a', 'Quick one.', 100)] });
    const promise = generateCoachLine(opts);
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toEqual({ text: 'Quick one.', source: 'ai', provider: 'a' });
  });
});

describe('never throws', () => {
  it('returns FALLBACK_LINE when providers is not iterable', async () => {
    const { out } = await run({ providers: 5 as unknown as CoachProvider[] });
    expect(out.text.length).toBeGreaterThan(0);
  });
});
