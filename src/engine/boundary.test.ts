import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !/\.test\.ts$/.test(f));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('engine boundary', () => {
  it('finds engine source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)('%s imports only from this folder', (file) => {
    const source = stripComments(readFileSync(join(dir, file), 'utf8'));
    const specs = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of specs) {
      const allowed = spec.startsWith('./') || (file === 'arbitraries.ts' && spec === 'fast-check');
      expect(allowed, `${file} imports ${spec}`).toBe(true);
    }
  });

  it.each(files)('%s uses no clock, randomness or network', (file) => {
    const source = stripComments(readFileSync(join(dir, file), 'utf8'));
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new\s+Date\s*\(\s*\)/);
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
