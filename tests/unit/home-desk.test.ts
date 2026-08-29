import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  normalizeDeskOrder,
  reorderDeskItem,
} from '@/features/home/model/homeDesk';
import { normalizeCardSet } from '@/domain/cards';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Home spatial desk', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const homeClient = readSource('src/features/home/client.ts');
  const homeDesk = readSource('src/features/home/components/HomeDesk.tsx');
  const homeModel = readSource('src/features/home/model/homeDesk.ts');
  const library = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const libraryProjection = readSource('src/features/storage-management/hooks/useAccountLibraryProjection.ts');

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
    expect(homeDesk).toContain('data-home-set-stack');
    expect(homeDesk).toContain('data-home-set-board');
    expect(homeDesk).toContain('aria-label="Work surrounding the focused Set"');
    expect(homeDesk).toContain('<CardPreview');
    expect(homeDesk).toContain('<AuthoredObjectPreview');
    expect(homeDesk).toContain('Inside this Set');
    expect(homeDesk).toContain('Pull back');
    expect(libraryProjection).toContain('isUntouchedBootstrapCardSet');
    expect(homeModel).not.toContain('isUntouchedBootstrapWork');
  });

  it('keeps organization and destructive actions attached to their native owners', () => {
    expect(homeDesk).toContain('writeProjectPreference');
    expect(homeDesk).toContain('moveGeneratedCardsToSet');
    expect(homeDesk).toContain('reorderGeneratedCard');
    expect(homeDesk).toContain('removeGeneratedCards');
    expect(homeDesk).toContain('selectedCardIds');
    expect(homeDesk).toContain('updateCardSetOrganization');
    expect(homeDesk).toContain('setCardPositions');
    expect(homeDesk).toContain('setCardsTag');
    expect(homeDesk).toContain('By content type');
    expect(homeDesk).toContain('duplicateCardSet');
    expect(homeDesk).toContain('deleteCardSet');
    expect(homeDesk).toContain('Save &amp; move');
    expect(homeDesk).toContain('Export / print');
    expect(homeDesk).toContain('Duplicate');
    expect(homeDesk).toContain('Send to Pipeline');
    expect(homeDesk).toContain('submitSet=');
    expect(homeDesk).toContain('<AlertDialog');
  });

  it('keeps focused Set organization durable and normalizes unsafe persisted geometry', () => {
    expect(normalizeCardSet({
      id: 'set:organized', name: 'Organized', frontTemplateId: null, backingTemplateId: null,
      organization: {
        arrangement: 'manual', groupBy: 'field', groupField: 'faction', sort: 'field-value', sortField: 'rank',
        tags: [{ id: 'tag:red', label: 'Red' }], positions: { 'card:one': { x: 12, y: 24 }, bad: { x: 'no', y: 2 } },
      },
    })?.organization).toEqual({
      arrangement: 'manual', groupBy: 'field', groupField: 'faction', sort: 'field-value', sortField: 'rank',
      tags: [{ id: 'tag:red', label: 'Red' }], positions: { 'card:one': { x: 12, y: 24 } },
    });
  });

  it('keeps a durable desk order while admitting new and removing stale work', () => {
    expect(normalizeDeskOrder(['set:a', 'set:b', 'set:c'], ['set:c', 'missing', 'set:a']))
      .toEqual(['set:c', 'set:a', 'set:b']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:c', 'set:a'))
      .toEqual(['set:c', 'set:a', 'set:b']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:b', 'earlier'))
      .toEqual(['set:b', 'set:a', 'set:c']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:b', 'later'))
      .toEqual(['set:a', 'set:c', 'set:b']);
  });

  it('reports provider connection health independently from whether Drive already contains work', () => {
    expect(homeDesk).toContain('projection.driveConnection?.connected');
    expect(homeDesk).not.toContain("projection.sourceCounts.get('google-drive') ? 'Drive connected'");
  });

  it('keeps a newly created Set in rename mode after it becomes the focused work', () => {
    const focusEffect = homeDesk.slice(homeDesk.indexOf('if (!focusedItemId) return;'), homeDesk.indexOf('const statuses'));
    expect(homeDesk).toContain('setFocusedWorkId(`set:${id}`);');
    expect(homeDesk).toContain('setRenaming(true);');
    expect(focusEffect).not.toContain('setRenaming(false)');
  });

  it('starts fresh or published work through one canonical Set-copy boundary', () => {
    expect(homeDesk).toContain('Start a new Set');
    expect(homeDesk).toContain('Fresh Set');
    expect(homeDesk).toContain('createPublishedSetCopy');
    expect(homeDesk).toContain('catalog.sets?.items ?? []');
    expect(homeDesk).not.toContain('createPlayingCardDeck');
  });
});
