import { describe, expect, it } from 'vitest';

import {
  isVercelNonRuntimePath,
  shouldIgnoreVercelBuild,
} from '../../scripts/vercel-build-cadence.mjs';

describe('Vercel build cadence', () => {
  it('ignores documentation, tests, and agent-instruction-only changes', () => {
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
});
