import { PROVIDER_TIMEOUT_MS, TOTAL_BUDGET_MS } from './constants';
import { containsDash, normalizeDashes } from './dashes';
import { coachInputSchema, coachOutputSchema } from './schemas';
import { FALLBACK_LINE, pickTemplate } from './templates';
import type { CoachInput, CoachOutput, CoachProvider } from './types';
import { validateCoachText } from './validate';

export interface GenerateCoachLineOptions {
  /** Parsed inside with the strict schema. Invalid input gives FALLBACK_LINE. */
  input: unknown;
  providers: readonly CoachProvider[];
  online: boolean;
  aiEnabled: boolean;
  /** Spends one AI call from today's budget. True means the call may go ahead. */
  spendAiCall: () => Promise<boolean>;
  seed: string;
  lastText?: string;
}

type Raced<T> = { kind: 'value'; value: T } | { kind: 'error' } | { kind: 'aborted' };

const FALLBACK: CoachOutput = { text: FALLBACK_LINE, source: 'template' };

/** Turns a sync throw into a rejection. */
function attempt<T>(fn: () => Promise<T> | T): Promise<T> {
  return new Promise<T>((resolve) => resolve(fn()));
}

/** First of: the promise settles, or the signal aborts. Late results are ignored. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<Raced<T>> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    return Promise.resolve({ kind: 'aborted' });
  }
  return new Promise<Raced<T>>((resolve) => {
    let settled = false;
    const finish = (result: Raced<T>) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => finish({ kind: 'aborted' });
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish({ kind: 'value', value }),
      () => finish({ kind: 'error' }),
    );
  });
}

async function tryProvider(
  provider: CoachProvider,
  input: CoachInput,
  total: AbortSignal,
): Promise<CoachOutput | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  // The provider's signal follows the total budget, so it gets at most the time left.
  const forward = () => controller.abort();
  total.addEventListener('abort', forward, { once: true });
  try {
    const result = await raceAbort(
      attempt(() => provider.generate(input, { signal: controller.signal })),
      controller.signal,
    );
    if (result.kind !== 'value' || typeof result.value !== 'string') return null;
    const checked = validateCoachText(normalizeDashes(result.value));
    if (!checked.ok || containsDash(checked.text)) return null;
    const output = coachOutputSchema.safeParse({ text: checked.text, source: 'ai', provider: provider.name });
    return output.success ? output.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    total.removeEventListener('abort', forward);
  }
}

/** Returns a coach line in every case. Never throws or rejects. */
export async function generateCoachLine(options: GenerateCoachLineOptions): Promise<CoachOutput> {
  try {
    const parsed = coachInputSchema.safeParse(options.input);
    if (!parsed.success) return FALLBACK;
    const input = Object.freeze({ ...parsed.data });
    const template = (): CoachOutput => ({
      text: pickTemplate(input, options.seed, options.lastText),
      source: 'template',
    });

    if (!options.online || !options.aiEnabled || options.providers.length === 0) return template();

    const total = new AbortController();
    const totalTimer = setTimeout(() => total.abort(), TOTAL_BUDGET_MS);
    try {
      const spend = await raceAbort(attempt(() => options.spendAiCall()), total.signal);
      if (spend.kind !== 'value' || spend.value !== true) return template();

      for (const provider of options.providers) {
        if (total.signal.aborted) break;
        const output = await tryProvider(provider, input, total.signal);
        if (output) return output;
      }
      return template();
    } finally {
      clearTimeout(totalTimer);
    }
  } catch {
    return FALLBACK;
  }
}
