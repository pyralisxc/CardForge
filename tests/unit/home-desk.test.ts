import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getWorkActions,
  normalizeDeskOrder,
  reorderDeskItem,
} from '@/features/home/model/homeDesk';
import { normalizeCardSet } from '@/domain/cards';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Home spatial desk', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const homeClient = readSource('src/features/home/client.ts');
  const homeDesk = readSource('src/features/home/components/HomeDesk.tsx');
  const homeController = readSource('src/features/home/hooks/useHomeDeskController.ts');
  const homeNavigation = readSource('src/features/home/hooks/useHomeCreatorNavigation.ts');
  const homeHistory = readSource('src/features/home/model/homeCreatorHistory.ts');
  const artifactSurface = readSource('src/features/home/components/FocusedSetArtifactSurface.tsx');
  const focusedWorkSurface = readSource('src/features/home/components/FocusedWorkSurface.tsx');
  const overviewSurface = readSource('src/features/home/components/DeskOverviewSurface.tsx');
  const homeDialogs = readSource('src/features/home/components/HomeDeskDialogs.tsx');
  const homeRuntime = `${homeDesk}\n${homeController}\n${homeNavigation}\n${homeHistory}`;
  const homeSurface = `${homeRuntime}\n${focusedWorkSurface}\n${overviewSurface}\n${homeDialogs}`;
  const homeDeskStyles = readSource('src/features/home/components/HomeDesk.module.css');
  const globalStyles = readSource('src/app/globals.css');
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
    expect(overviewSurface).toContain('data-home-desk="overview"');
    expect(focusedWorkSurface).toContain('data-home-desk="focused"');
    expect(homeRuntime).toContain('data-home-desk-plane');
    expect(overviewSurface).toContain('data-home-work-object');
    expect(homeSurface).toContain('data-home-set-stack');
    expect(focusedWorkSurface).toContain('data-home-set-board');
    expect(homeSurface).not.toContain('aria-label="Work surrounding the focused Set"');
    expect(focusedWorkSurface).toContain('<FocusedSetArtifactSurface');
    expect(artifactSurface).toContain('<CardPreview');
    expect(artifactSurface).toContain('data-home-artifact-stage');
    expect(homeRuntime).toContain('<AuthoredObjectPreview');
    expect(focusedWorkSurface).toContain('Inside this Set');
    expect(focusedWorkSurface).toContain('Back to Desk');
    expect(homeNavigation).toContain('window.history.replaceState');
    expect(homeNavigation).toContain('window.history.pushState');
    expect(libraryProjection).not.toContain('isUntouchedBootstrapCardSet');
    expect(homeModel).not.toContain('isUntouchedBootstrapWork');
  });

  it('keeps the complete focused Set reachable while mounting only the visible 2D projection', () => {
    expect(homeSurface).not.toContain('.slice(0, 24)');
    expect(artifactSurface).toContain('projectVisibleArtifacts');
    expect(artifactSurface).toContain('Ordered Artifact navigator');
    expect(artifactSurface).toContain('layout.entries.map');
    expect(artifactSurface).not.toContain('draggable=');
    expect(artifactSurface).not.toContain('onDragEnd');
    expect(artifactSurface).toContain('onPointerDown');
    expect(artifactSurface).toContain("prefers-reduced-motion: reduce");
  });

  it('uses a single-surface focus animation instead of duplicating Set previews through native view transitions', () => {
    expect(homeRuntime).not.toContain('startViewTransition');
    expect(homeRuntime).not.toContain('viewTransitionName');
    expect(homeDeskStyles).toContain('animation: focus-workspace-enter');
    expect(globalStyles).not.toContain('::view-transition');
  });

  it('keeps a local Set on Desk until a contained object is chosen for Studio', () => {
    const localSet: AccountLibraryItem = {
      id: 'set:set-alpha',
      kind: 'set',
      name: 'Set Alpha',
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: ['0 cards', 'Device only'],
      sizeBytes: null,
      revision: null,
      updatedAt: null,
      expiresAt: null,
      webViewLink: null,
      references: { localSetId: 'set-alpha' },
    };

    expect(getWorkActions(localSet, false, true)[0]).toMatchObject({
      id: 'home.open-work',
      label: 'Open Set',
      ownerFeature: 'project',
    });
    expect(homeController).toContain("'home.open-work': () =>");
    expect(homeController).toContain('createActionRuntime(actionDefinitions)');
    expect(homeController).not.toContain("action.id === 'home.open-work'");
    expect(focusedWorkSurface).toContain('!props.localSetId ? <button');
    expect(homeRuntime).toContain("onOpenWork={() => openWorkLane(focusedItem, 'open')}");
  });

  it('keeps organization and destructive actions attached to their native owners', () => {
    expect(homeRuntime).toContain('writeProjectPreference');
    expect(homeRuntime).toContain('moveGeneratedCardsToSet');
    expect(homeRuntime).toContain('reorderGeneratedCard');
    expect(homeRuntime).toContain('removeGeneratedCards');
    expect(homeRuntime).toContain('selectedCardIds');
    expect(homeRuntime).toContain('updateCardSetOrganization');
    expect(homeRuntime).toContain('setCardPositions');
    expect(homeRuntime).toContain('setCardsTag');
    expect(focusedWorkSurface).toContain('By content type');
    expect(homeRuntime).toContain('duplicateCardSet');
    expect(homeRuntime).toContain('deleteCardSet');
    expect(focusedWorkSurface).toContain('Save &amp; move');
    expect(homeSurface).toContain('Export / print');
    expect(homeSurface).toContain('Duplicate');
    expect(homeSurface).toContain('Send to Pipeline');
    expect(homeRuntime).toContain('openPipelineSubmission');
    expect(homeRuntime).toContain('<EnvironmentToolLayer');
    expect(homeRuntime).not.toContain('scope=pipeline&tool=contribute');
    expect(homeDialogs).toContain('<AlertDialog');
  });

  it('keeps focused Set organization durable and normalizes unsafe persisted geometry', () => {
    expect(normalizeCardSet({
      id: 'set:organized', name: 'Organized',
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
    expect(homeRuntime).toContain('projection.driveConnection?.connected');
    expect(homeRuntime).not.toContain("projection.sourceCounts.get('google-drive') ? 'Drive connected'");
  });

  it('does not present unloaded provider contents as an empty Set', () => {
    expect(homeRuntime).toContain("'Contents load when opened'");
    expect(homeRuntime).toContain('contentsLabel={focusedContentsLabel}');
    expect(focusedWorkSurface).toContain('{props.contentsLabel} · {workSourceLabel(props.item)}');
    expect(homeSurface).not.toContain("<p>{focusedCards.length} card{focusedCards.length === 1 ? '' : 's'} · {workSourceLabel(focusedItem)}</p>");
  });

  it('keeps a newly created Set in rename mode after it becomes the focused work', () => {
    const focusEffect = homeController.slice(homeController.indexOf('if (!focusedItemId) return;'), homeController.indexOf('const statuses'));
    expect(homeController).toContain('focusWorkContext(`set:${id}`, id)');
    expect(homeRuntime).toContain('setRenaming(true);');
    expect(focusEffect).not.toContain('setRenaming(false)');
  });

  it('restores the focused Set after Studio closes', () => {
    expect(accountPage).toContain('initialFocusedWorkId={initialFocusedWorkId}');
    expect(accountPage).toContain("key={initialFocusedWorkId || initialReturnContextKey ? `home-desk:${initialFocusedWorkId ?? 'overview'}:${initialReturnContextKey ?? 'fresh'}` : 'home-desk'}");
    expect(homeRuntime).toContain('initialFocusedWorkId?: string | null;');
    expect(homeNavigation).toContain('useState<string | null>(initialFocusedWorkId ?? null)');
    expect(homeRuntime).toContain('createDeskStudioReturnTo(item.id)');
    expect(homeRuntime).toContain('openContextStudio');
    expect(homeRuntime).toContain('storeSurfaceReturnContext');
    expect(homeRuntime).toContain('readSurfaceReturnContext');
    expect(homeRuntime).toContain('initialReturnContextKey');
    expect(homeNavigation).toContain('readHomeCreatorHistorySnapshot(event.state)');
    expect(homeHistory).toContain("params.set('tool', activeTool.toolId)");
    expect(homeNavigation).toContain("event.key !== 'Escape'");
    expect(homeNavigation).toContain('requestHistoryBack()');
  });

  it('keeps contextual tools in the creator session and guards a dirty Design boundary', () => {
    expect(homeController).not.toContain('useState<{ setId: string; tool:');
    expect(homeController).not.toContain('useState<string | null>(null);\n  const [generateSetId');
    expect(homeController).toContain('interactionSession.toolStack.at(-1)');
    expect(homeNavigation).toContain('openCreatorTool(focused.session');
    expect(homeDesk).toContain('manageHistory={false}');
    expect(homeDesk).toContain('dirty={interactionSession.toolStack.at(-1)?.dirty ?? false}');
    expect(homeDesk).toContain("onDirtyChange={studioTool.tool === 'design' ? setActiveToolDirty : undefined}");
    expect(homeDialogs).toContain('Close Design with unsaved changes?');
  });

  it('starts fresh or published work through one canonical Set-copy boundary', () => {
    expect(homeDialogs).toContain('Start a new Set');
    expect(homeDialogs).toContain('Fresh Set');
    expect(homeRuntime).toContain('createPublishedSetCopy');
    expect(homeRuntime).toContain('catalog.sets?.items ?? []');
    expect(homeRuntime).not.toContain('createPlayingCardDeck');
  });
});
