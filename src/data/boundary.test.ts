import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = __dirname;
const sources = readdirSync(dir).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'repository-contract.ts',
);

function importsOf(file: string): string[] {
  const text = readFileSync(join(dir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
}

describe('data layer boundary', () => {
  it('finds source files', () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  it.each(sources)('%s respects the import rules', (file) => {
    for (const spec of importsOf(file)) {
      if (spec === 'dexie') {
        expect(['db.ts', 'dexie-repository.ts'], `${file} imports dexie`).toContain(file);
      }
      expect(spec, `${file} imports ${spec}`).not.toMatch(/^@\/(coach|components|app)(\/|$)/);
      expect(spec, `${file} imports a test library`).not.toMatch(/vitest|fake-indexeddb|testing-library/);
    }
  });

  it('only hooks.ts is a client module', () => {
    for (const file of sources) {
      const first = readFileSync(join(dir, file), 'utf8').trimStart().slice(0, 14);
      expect(first.startsWith("'use client'"), file).toBe(file === 'hooks.ts');
    }
  });
});
