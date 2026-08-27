import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Home spatial desk', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const homeClient = readSource('src/features/home/client.ts');
  const homeDesk = readSource('src/features/home/components/HomeDesk.tsx');
  const homeModel = readSource('src/features/home/model/homeDesk.ts');
  const library = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');

  it('owns Home separately from the storage-management Library surface', () => {
    expect(accountPage).toContain("from '@/features/home/client'");
    expect(accountPage).toContain('<HomeDesk');
    expect(homeClient).toContain('export { HomeDesk }');
    expect(library).not.toContain("view === 'home'");
    expect(library).not.toContain('Account snapshot');
  });

  it('implements one authored-work object at two spatial scales', () => {
    expect(homeDesk).toContain('data-home-desk="overview"');
    expect(homeDesk).toContain('data-home-desk="focused"');
    expect(homeDesk).toContain('data-home-desk-plane');
    expect(homeDesk).toContain('data-home-work-object');
    expect(homeDesk).toContain('aria-label="Nearby work"');
    expect(homeDesk).toContain('<CardPreview');
    expect(homeDesk).toContain('Cards in this work');
    expect(homeDesk).toContain('Back to desk');
    expect(homeDesk).toContain('isUntouchedBootstrapWork');
    expect(homeModel).toContain("item.references.localSetId === 'active-card-set'");
  });

  it('keeps organization and destructive actions attached to their native owners', () => {
    expect(homeDesk).toContain('writeProjectPreference');
    expect(homeDesk).toContain('moveGeneratedCardToSet');
    expect(homeDesk).toContain('duplicateCardSet');
    expect(homeDesk).toContain('deleteCardSet');
    expect(homeDesk).toContain('<AlertDialog');
  });

  it('keeps a newly created Set in rename mode after it becomes the focused work', () => {
    const focusEffect = homeDesk.slice(homeDesk.indexOf('if (!focusedItemId) return;'), homeDesk.indexOf('const statuses'));
    expect(homeDesk).toContain('setFocusedWorkId(`set:${id}`);');
    expect(homeDesk).toContain('setRenaming(true);');
    expect(focusEffect).not.toContain('setRenaming(false)');
  });
});
