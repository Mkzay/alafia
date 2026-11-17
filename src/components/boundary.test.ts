import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const files = [...walk(join(SRC, 'components')), ...walk(join(SRC, 'app'))];

interface Import {
  spec: string;
  names: string[];
}

function importsOf(file: string): Import[] {
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...text.matchAll(/^\s*import\s+(?:type\s+)?([\s\S]*?)\s+from\s+'([^']+)'/gm)].map((m) => ({
    spec: m[2],
    names: (/\{([\s\S]*)\}/.exec(m[1])?.[1] ?? '')
      .split(',')
      .map((n) => n.replace(/^\s*type\s+/, '').split(/\s+as\s+/)[0].trim())
      .filter(Boolean),
  }));
}

/** UI-1, UI-16, U14.1, U14.2. */
const DATA_ALLOWED = ['@/data/hooks', '@/data/schemas', '@/data/errors'];
const ENGINE_ALLOWED: Record<string, string[] | 'any'> = {
  '@/engine/quests': ['QUEST_DEFINITIONS'],
  '@/engine/levels': ['avatarTier'],
  '@/engine/types': 'any',
  '@/engine/constants': 'any',
};
const COACH_ALLOWED = ['@/coach/sanitize', '@/coach/orchestrator', '@/coach/templates', '@/coach/types'];

describe('UI boundary', () => {
  it('finds UI files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => relative(SRC, f)))('%s respects the import rules', (rel) => {
    for (const { spec, names } of importsOf(join(SRC, rel))) {
      expect(spec, `${rel} imports dexie`).not.toBe('dexie');
      if (spec.startsWith('@/data/')) {
        expect(DATA_ALLOWED, `${rel} imports ${spec}`).toContain(spec);
      }
      if (spec.startsWith('@/engine/')) {
        const allowed = ENGINE_ALLOWED[spec];
        expect(allowed, `${rel} imports ${spec}`).toBeDefined();
        if (allowed !== 'any') {
          for (const n of names) expect(allowed, `${rel} imports ${n} from ${spec}`).toContain(n);
        }
      }
      if (spec.startsWith('@/coach/')) {
        expect(COACH_ALLOWED, `${rel} imports ${spec}`).toContain(spec);
      }
    }
  });
});
