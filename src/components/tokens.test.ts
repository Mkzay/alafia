import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const tokens = Object.fromEntries(
  [...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const STATS = ['stat-strength', 'stat-endurance', 'stat-agility', 'stat-vitality', 'stat-recovery'];

describe('design tokens (U12.1)', () => {
  it('parses the color tokens', () => {
    for (const k of ['bg', 'surface', 'surface-2', 'text', 'text-muted', 'accent', 'accent-ink', 'gold', 'line-strong', ...STATS]) {
      expect(tokens[k], k).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('body and muted text reach 4.5:1 on every background', () => {
    for (const bg of ['bg', 'surface', 'surface-2']) {
      for (const fg of ['text', 'text-muted']) {
        expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('accent, gold and stat colors reach 4.5:1 on the backgrounds they sit on', () => {
    for (const bg of ['bg', 'surface', 'surface-2']) {
      for (const fg of ['accent', 'gold', ...STATS]) {
        expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('text on accent reaches 4.5:1', () => {
    expect(contrast(tokens['accent-ink'], tokens.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('UI edges and bar tracks reach 3:1 against their background', () => {
    expect(contrast(tokens['line-strong'], tokens.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens['line-strong'], tokens.bg)).toBeGreaterThanOrEqual(3);
  });
});
