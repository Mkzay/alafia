import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './ids';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newId', () => {
  it('returns unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
    ids.forEach((id) => expect(id).toMatch(UUID));
  });

  it('falls back when randomUUID is missing', () => {
    const real = crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    expect(newId()).toMatch(UUID);
  });

  it('falls back when crypto is missing', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newId()).toMatch(UUID);
  });
});
