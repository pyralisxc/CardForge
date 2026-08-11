import { readFileSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...segments: string[]) => resolve(process.cwd(), ...segments);
const read = (...segments: string[]) => readFileSync(rootPath(...segments), 'utf8');

const RETIRED_OPERATOR_PARTIAL = ['Neon', 'Black'].join(' ');
const APPROVED_OPERATOR_DESCRIPTION =
  'CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.';

const ignoredDirectoryNames = new Set([
  '.git',
  '.next',
  '.worktrees',
  'coverage',
  'node_modules',
  'test-results',
]);

const textExtensions = new Set([
  '.css', '.env', '.example', '.html', '.js', '.json', '.jsx', '.md', '.mjs',
  '.cjs', '.scss', '.sql', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);
const extensionlessTextFiles = new Set(['CODEOWNERS', 'CONTRIBUTING', 'LICENSE']);

const isTextFile = (entry: Dirent): boolean => {
  const dot = entry.name.lastIndexOf('.');
  const extension = dot >= 0 ? entry.name.slice(dot).toLowerCase() : '';
  return textExtensions.has(extension) || extensionlessTextFiles.has(entry.name);
};

const textFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    if (ignoredDirectoryNames.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return entry.isFile() && isTextFile(entry) ? [path] : [];
  });

const searchableText = (file: string): string => readFileSync(file, 'utf8')
  .replace(/'\s*\|\|\s*'/g, '')
  .toLowerCase();

describe('current operator repository policy', () => {
  it('allows the retired operator only in immutable history and approved transition records', () => {
    const allowed = [
      'docs/operator-identity-and-transfer-runbook.md',
      'supabase/migrations/202607140005_legal_business_identity.sql',
      'supabase/migrations/20260716210518_business_identity_foundation.sql',
    ];
    const matches = textFiles(process.cwd())
      .filter((file) => searchableText(file).includes(RETIRED_OPERATOR_PARTIAL.toLowerCase()))
      .map((file) => relative(process.cwd(), file).replaceAll('\\', '/'))
      .sort();

    expect(matches).toEqual(allowed);

    expect(read('supabase/migrations/202607140005_legal_business_identity.sql'))
      .toContain('Align live operator identity and billing language with current operations.');
  });

  it('uses the canonical operator description in production health checks', () => {
    expect(read('scripts/check-production-health.mjs')).toContain(
      `{ path: '/privacy', content: '${APPROVED_OPERATOR_DESCRIPTION}' }`,
    );
  });

  it('publishes Cameron ownership in repository policy', () => {
    expect(read('LICENSE')).toContain('Copyright (c) 2026 Cameron Locke. All rights reserved.');
    expect(read('.github/CODEOWNERS')).toContain('/src/features/business-identity/ @pyralisxc');
  });
});
