import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = __dirname;
const sources = readdirSync(dir).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));

function code(file: string): string {
  return readFileSync(join(dir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('coach boundary', () => {
  it('finds the coach source files', () => {
    expect(sources).toEqual(
      expect.arrayContaining(['orchestrator.ts', 'validate.ts', 'sanitize.ts', 'templates.ts', 'template-lines.ts']),
    );
  });

  it.each(sources)('%s imports only ./, zod, and engine types', (file) => {
    const text = code(file);
    for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^'"]*?from\s+'([^']+)'/gm)) {
      const isType = Boolean(m[1]);
      const spec = m[2];
      if (spec.startsWith('./')) continue;
      if (spec === 'zod') continue;
      if (spec.startsWith('@/engine/')) {
        expect(isType, `${file} must use import type for ${spec}`).toBe(true);
        continue;
      }
      throw new Error(`${file} imports ${spec}`);
    }
    expect(text, file).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  it.each(sources)('%s reads no clock and makes no network call', (file) => {
    const text = code(file);
    expect(text).not.toMatch(/Date\.now\s*\(/);
    expect(text).not.toMatch(/new\s+Date\b/);
    expect(text).not.toMatch(/performance\.now/);
    expect(text).not.toMatch(/Math\.random/);
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/console\./);
  });
});
