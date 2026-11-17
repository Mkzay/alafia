// Fails if any file under .kiro would be ignored by git. Run by a hook and by `pnpm test`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const probes = ['.kiro/steering/tech.md', '.kiro/specs/engine/requirements.md', '.kiro/hooks/probe.json'];
const problems = [];

if (existsSync('.gitignore')) {
  readFileSync('.gitignore', 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (/^\s*\/?\.kiro(\/.*)?\s*$/.test(line)) problems.push(`.gitignore line ${i + 1} ignores .kiro: "${line.trim()}"`);
    });
}

for (const file of probes) {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { stdio: 'ignore' });
    problems.push(`git ignores ${file}`);
  } catch (error) {
    // Exit 1 means "not ignored", which is what we want. Anything else is a git problem.
    if (error && error.status !== 1) problems.push(`could not run git check-ignore (${error.message})`);
  }
}

if (problems.length > 0) {
  console.error('.kiro must be committed and never ignored:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('.kiro is tracked and not ignored.');
