import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('.kiro guard', () => {
  it('.kiro is not git-ignored', () => {
    const result = spawnSync('node', ['scripts/check-kiro-tracked.mjs'], { encoding: 'utf8' });
    expect(result.stderr, result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
