import { describe, expect, it, vi } from 'vitest';

import {
  createActionRuntime,
  createActionDefinition,
  type ActionDescriptor,
  type ActionOperation,
} from '@/features/app-shell/client/environment';
import {
  createSendToPipelineActionDefinition,
  createSendToPipelineActionDescriptor,
} from '@/features/pipeline/client';
import { createAccountLibraryActionDefinitions, type AccountLibraryActionCommands } from '@/features/storage-management/lib/accountLibraryActions';

const descriptor: ActionDescriptor = {
  id: 'project.rename-work',
  label: 'Rename',
  ownerFeature: 'project',
  supportedObjectKinds: ['home-work'],
  supportedSources: ['browser-local'],
  revisionPolicy: 'none',
  requiredPermission: 'guest',
  scope: 'object',
  hierarchy: 'overflow',
  availability: { kind: 'available' },
  commitment: 'none',
  automation: { kind: 'human-only', owner: 'cardforge' },
  result: 'mutation',
};

describe('action runtime', () => {
  it('rejects metadata and execution ownership drift', () => {
    const operation: ActionOperation = {
      id: descriptor.id,
      ownerFeature: 'storage-management',
      result: 'mutation',
      execute: vi.fn(),
    };

    expect(() => createActionRuntime([{ descriptor, operation }]))
      .toThrow(/owner/i);
  });

  it('executes the feature-owned operation through the descriptor contract', async () => {
    const execute = vi.fn(async () => ({ kind: 'mutation' as const, changedIds: ['set-1'] }));
    const runtime = createActionRuntime([{
      descriptor,
      operation: {
        id: descriptor.id,
        ownerFeature: 'project',
        result: 'mutation',
        execute,
      },
    }]);

    await expect(runtime.execute(descriptor.id, { targetIds: ['set-1'] }))
      .resolves.toEqual({ kind: 'mutation', changedIds: ['set-1'] });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('creates an operation from the descriptor so execution metadata cannot drift', () => {
    const definition = createActionDefinition(descriptor, async () => ({ kind: 'mutation', changedIds: [] }));
    expect(definition.operation).toMatchObject({
      id: descriptor.id,
      ownerFeature: descriptor.ownerFeature,
      result: descriptor.result,
    });
  });

  it('keeps Desk and Library Pipeline actions on one publication/mutation contract', async () => {
    const desk = createSendToPipelineActionDescriptor({
      id: 'home.send-pipeline', objectKind: 'home-work', sources: ['browser-local'],
    });
    const openLibraryTool = vi.fn();
    const library = createSendToPipelineActionDefinition({
      id: 'library.send-pipeline', objectKind: 'set', sources: ['browser-local'], execute: openLibraryTool,
    });

    expect(desk).toMatchObject({ ownerFeature: 'pipeline', commitment: 'publication', result: 'mutation' });
    expect(library.descriptor).toMatchObject({ ownerFeature: 'pipeline', commitment: 'publication', result: 'mutation' });
    await expect(createActionRuntime([library]).execute('library.send-pipeline', { targetIds: ['set-1'] }))
      .resolves.toEqual({ kind: 'mutation', changedIds: ['set-1'] });
    expect(openLibraryTool).toHaveBeenCalledOnce();
  });

  it('binds Library metadata to feature-owned operations without surface dispatch', async () => {
    const open = vi.fn(() => '/account?focus=set%3Aset-1');
    const unavailable = vi.fn();
    const commands: AccountLibraryActionCommands = {
      closeLocations: unavailable, closeTool: unavailable, continuePersonal: unavailable,
      openPersonal: open, sendPipeline: unavailable, saveMove: unavailable, duplicate: unavailable,
      deleteCopy: unavailable, viewSource: unavailable, manageLocation: unavailable,
      usePublished: unavailable, copyPublishedTemplate: unavailable, editPipeline: unavailable,
      testPipeline: unavailable, refresh: unavailable,
    };
    const openDescriptor = { ...descriptor, id: 'library.open' as const, result: 'navigation' as const };
    const runtime = createActionRuntime(createAccountLibraryActionDefinitions([openDescriptor], commands));
    await expect(runtime.execute('library.open', { targetIds: ['set-1'] })).resolves.toEqual({
      kind: 'navigation', href: '/account?focus=set%3Aset-1',
    });
    expect(open).toHaveBeenCalledOnce();
    expect(unavailable).not.toHaveBeenCalled();
  });
});
