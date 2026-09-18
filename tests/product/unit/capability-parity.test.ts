import { describe, expect, it } from 'vitest';

import { getWorkActions } from '@/features/desk/model/desk';
import { createSendToPipelineActionDescriptor } from '@/features/pipeline/client';
import { buildAccountLibraryItems } from '@/features/storage-management/model/accountLibrary';
import { getAccountLibraryEnvironmentActions } from '@/features/storage-management/model/accountLibraryEnvironment';

describe('core workflow capability parity', () => {
  const buildWork = () => buildAccountLibraryItems({
    localSets: [{ id: 'local-set', name: 'Local Set', cardCount: 2, sizeBytes: 1200 }],
    driveProjects: [],
    driveBindingFileId: null,
    localWorkFolders: [],
    personalAssets: [],
    workingDrafts: [{
      id: 'draft',
      title: 'Assistant draft',
      revision: 1,
      creationSource: 'gpt',
      updatedAt: '2026-09-18T00:00:00.000Z',
      expiresAt: '2026-09-19T00:00:00.000Z',
    }],
  });

  it('uses the same capability identities across Desk and Library entry points', () => {
    const items = buildWork();
    const localSet = items.find((item) => item.references.localSetId === 'local-set');
    const draft = items.find((item) => item.references.workingDraftId === 'draft');
    expect(localSet).toBeDefined();
    expect(draft).toBeDefined();

    const desk = new Map(getWorkActions(localSet!, false, true, true, true)
      .map((action) => [action.id, action.capabilityId]));
    expect(desk.get('desk.open-set')).toBe('work.open');
    expect(desk.get('desk.generate-set')).toBe('work.generate');
    expect(desk.get('desk.export-set')).toBe('work.output');
    expect(desk.get('desk.save-move-set')).toBe('work.save-move');
    expect(desk.get('desk.send-pipeline')).toBe('pipeline.send');

    const library = new Map(getAccountLibraryEnvironmentActions(localSet!)
      .map((action) => [action.id, action.capabilityId]));
    expect(library.get('library.open')).toBe('work.open');
    expect(library.get('library.save-move')).toBe('work.save-move');

    expect(getWorkActions(draft!, false, true)
      .find((action) => action.id === 'desk.open-set')?.capabilityId).toBe('work.continue');
    expect(getAccountLibraryEnvironmentActions(draft!)[0]).toMatchObject({
      id: 'library.continue',
      capabilityId: 'work.continue',
    });
  });

  it('keeps Pipeline send identity stable across surfaces while Pipeline owns execution', () => {
    const desk = createSendToPipelineActionDescriptor({
      id: 'desk.send-pipeline',
      objectKind: 'set',
      sources: ['browser-local'],
    });
    const library = createSendToPipelineActionDescriptor({
      id: 'library.send-pipeline',
      objectKind: 'set',
      sources: ['browser-local'],
    });

    expect(desk).toMatchObject({ capabilityId: 'pipeline.send', ownerFeature: 'pipeline' });
    expect(library).toMatchObject({ capabilityId: 'pipeline.send', ownerFeature: 'pipeline' });
  });
});
