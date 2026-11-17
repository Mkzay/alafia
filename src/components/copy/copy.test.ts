import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containsDash } from '@/coach/dashes';
import { containsBannedTerm } from '@/coach/validate';

const PRESSURE = [/\bburn/i, /\bshred/i, /\bcheat/i, /\bgrind/i, /no excuses/i, /\bbroken\b/i, /\blazy\b/i, /\bfailed?\b/i];

function strings(value: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
  return out;
}

const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('UI copy (U13.5, U14.4)', () => {
  it('finds copy files', () => {
    expect(files).toContain('common.ts');
  });

  it.each(files)('%s has clean, non-empty strings', async (file) => {
    const mod = (await import(`./${file}`)) as Record<string, unknown>;
    const all = strings(mod, file, []);
    expect(all.length).toBeGreaterThan(0);
    for (const [path, text] of all) {
      expect(text.trim(), path).not.toBe('');
      expect(containsDash(text), `${path}: ${text}`).toBe(false);
      expect(text, `${path}: ${text}`).not.toMatch(/\s-\s/);
      expect(containsBannedTerm(text), `${path}: ${text}`).toBe(false);
      for (const p of PRESSURE) expect(text, `${path}: ${text}`).not.toMatch(p);
    }
  });
});
