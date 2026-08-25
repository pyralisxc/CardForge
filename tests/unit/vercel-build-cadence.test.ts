import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isVercelNonRuntimePath,
  shouldIgnoreVercelBuild,
} from '../../scripts/vercel-build-cadence.mjs';

describe('Vercel build cadence', () => {
  it('ignores documentation, tests, and agent-instruction-only changes after a preview is requested', () => {
    expect(shouldIgnoreVercelBuild([
      'docs/operations.md',
      'tests/unit/example.test.ts',
      '.agents/skills/lean-repository-execution/SKILL.md',
      'AGENTS.md',
      'README.md',
    ])).toBe(true);
  });

  it('requires a build when any shipped or unknown path changes', () => {
    for (const filePath of [
      'src/app/page.tsx',
      'package.json',
      'supabase/migrations/202608200001_example.sql',
      'plugins/cardforge-studio/manifest.json',
      'vercel.json',
      '.github/workflows/ci.yml',
    ]) {
      expect(isVercelNonRuntimePath(filePath), filePath).toBe(false);
      expect(shouldIgnoreVercelBuild(['docs/notes.md', filePath]), filePath).toBe(false);
    }
  });

  it('requires a build when the change set is empty or uncertain', () => {
    expect(shouldIgnoreVercelBuild([])).toBe(false);
  });

  it('allows automatic Git deployments only from main and the managed release lanes', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      git?: { deploymentEnabled?: Record<string, boolean> };
      ignoreCommand?: string;
    };

    expect(config.git?.deploymentEnabled).toEqual({
      '*': false,
      '**': false,
      main: true,
      'vercel-preview': true,
    });
    expect(config.ignoreCommand).toBe('node scripts/vercel-build-cadence.mjs');
  });

  it('requires Cameron to review the stable Preview candidate before main merges', () => {
    const agentRules = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8');
    const leanSkill = readFileSync(
      join(process.cwd(), '.agents/skills/lean-repository-execution/SKILL.md'),
      'utf8',
    );

    for (const source of [agentRules, leanSkill]) {
      expect(source).toContain('https://card-forge-git-vercel-preview-pyralis-projects.vercel.app');
      expect(source).toContain('exact candidate SHA');
      expect(source).toContain('explicit approval');
    }
  });
});
