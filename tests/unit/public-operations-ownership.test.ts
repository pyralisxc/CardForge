import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

describe('public operations ownership', () => {
  it('gives public content, legal documents, contact requests, and roadmap records dedicated owners', async () => {
    const requiredPaths = [
      ['src', 'features', 'public-site', 'model', 'siteContent.ts'],
      ['src', 'features', 'public-site', 'server', 'contentStore.ts'],
      ['src', 'features', 'legal', 'model', 'legalDocument.ts'],
      ['src', 'features', 'legal', 'server', 'legalDocumentStore.ts'],
      ['src', 'features', 'contact', 'model', 'contactRequest.ts'],
      ['src', 'features', 'contact', 'server', 'contactRequestStore.ts'],
      ['src', 'features', 'roadmap', 'model', 'roadmap.ts'],
      ['src', 'features', 'roadmap', 'server', 'roadmapStore.ts'],
    ];

    for (const requiredPath of requiredPaths) {
      await expect(pathExists(...requiredPath), requiredPath.join('/')).resolves.toBe(true);
    }
  });

  it('removes Roadmap behavior from Account', async () => {
    for (const retiredPath of [
      ['src', 'features', 'account', 'lib', 'roadmap.ts'],
      ['src', 'features', 'account', 'lib', 'roadmapStore.ts'],
      ['src', 'features', 'account', 'components', 'RoadmapPage.tsx'],
      ['src', 'features', 'account', 'components', 'RoadmapPanel.tsx'],
    ]) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('keeps Owner as a composition shell instead of the public-record owner', async () => {
    const ownerModel = await readFile(rootPath('src', 'features', 'owner', 'lib', 'ownerConsole.ts'), 'utf8');
    const ownerStore = await readFile(rootPath('src', 'features', 'owner', 'lib', 'ownerConsoleStore.ts'), 'utf8');

    expect(ownerModel).not.toContain('export interface OwnerSettings');
    expect(ownerModel).not.toContain('export interface OwnerContactRequest');
    expect(ownerModel).not.toContain('export interface OwnerRoadmapItem');
    expect(ownerModel).not.toContain('export interface LegalDocument');
    expect(ownerStore).toContain("from '@/features/public-site/server'");
    expect(ownerStore).toContain("from '@/features/legal/server'");
    expect(ownerStore).toContain("from '@/features/contact/server'");
    expect(ownerStore).toContain("from '@/features/roadmap/server'");
  });

  it('routes public App pages through their owning server interfaces', async () => {
    for (const pagePath of [
      ['src', 'app', 'page.tsx'],
      ['src', 'app', 'about', 'page.tsx'],
      ['src', 'app', 'privacy', 'page.tsx'],
      ['src', 'app', 'terms', 'page.tsx'],
      ['src', 'app', 'contact', 'page.tsx'],
      ['src', 'app', 'roadmap', 'page.tsx'],
    ]) {
      const source = await readFile(rootPath(...pagePath), 'utf8');
      expect(source, pagePath.join('/')).not.toContain("from '@/features/owner/server'");
    }
  });
});
