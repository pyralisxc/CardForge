"use client";

import { useToast } from '@/components/ui/use-toast';
import {
  createActionDefinition,
  createActionRuntime,
  type ActionDescriptor,
  type ActionOperationResult,
} from '@/features/app-shell/client/environment';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { createSendToPipelineActionDefinition } from '@/features/pipeline/client';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import { getWorkActions, workDetailRecord, zoneAction } from '../model/desk';

interface DeskActionCommands {
  createWork: () => void;
  reviewWork: (item: AccountLibraryItem) => void;
  focusWork: (item: AccountLibraryItem) => ActionOperationResult;
  openRemoteWork: (item: AccountLibraryItem) => Promise<ActionOperationResult>;
  openGenerate: (setId: string) => void;
  openOutput: (setId: string) => void;
  openLocation: (item: AccountLibraryItem) => void;
  openPipeline: (setId: string) => void;
  renameWork: (item: AccountLibraryItem) => void;
  duplicateWork: (item: AccountLibraryItem) => string;
  deleteWork: (item: AccountLibraryItem) => void;
  manageLocation: () => ActionOperationResult;
}

interface DeskActionRuntimeOptions {
  experience: AccountExperienceProjection;
  focusedItem: AccountLibraryItem | null;
  inspectorItem: AccountLibraryItem | null;
  commands: DeskActionCommands;
}

export function useDeskActionRuntime({
  experience,
  focusedItem,
  inspectorItem,
  commands,
}: DeskActionRuntimeOptions) {
  const { toast } = useToast();
  const actionItem = inspectorItem ?? focusedItem;
  const descriptors: ActionDescriptor[] = inspectorItem
    ? getWorkActions(inspectorItem, true, experience.contributor.canSubmit, experience.capabilities.canUseProjectFiles, experience.owner && experience.signedIn)
    : focusedItem
      ? getWorkActions(focusedItem, true, experience.contributor.canSubmit, experience.capabilities.canUseProjectFiles, experience.owner && experience.signedIn)
      : [zoneAction('desk.create-set', 'New Set', 'tool-opened')];
  const requireItem = () => { if (!actionItem) throw new Error('Choose a Desk object first.'); return actionItem; };
  const requireSet = () => { const item = requireItem(); if (!item.references.localSetId) throw new Error('Open this Set in the browser first.'); return item.references.localSetId; };
  const operations: Record<string, () => ActionOperationResult | Promise<ActionOperationResult>> = {
    'desk.review-manage': () => { const item = requireItem(); if (!experience.owner || !experience.signedIn || !item.references.pipelineReviewTarget) throw new Error('Exact Owner review is unavailable. Refresh Desk.'); commands.reviewWork(item); return {kind:'tool-opened',toolId:'review-manage'}; },
    'desk.create-set': () => { commands.createWork(); return { kind: 'tool-opened', toolId: 'create-set' }; },
    'desk.open-set': () => { const item = requireItem(); return item.references.localSetId ? commands.focusWork(item) : commands.openRemoteWork(item); },
    'desk.generate-set': () => { commands.openGenerate(requireSet()); return { kind: 'tool-opened', toolId: 'generate' }; },
    'desk.export-set': () => { commands.openOutput(requireSet()); return { kind: 'tool-opened', toolId: 'output' }; },
    'desk.save-move-set': () => { commands.openLocation(requireItem()); return { kind: 'tool-opened', toolId: 'locations' }; },
    'desk.rename-set': () => { commands.renameWork(requireItem()); return { kind: 'tool-opened', toolId: 'rename-set' }; },
    'desk.duplicate-set': () => ({ kind: 'mutation', changedIds: [commands.duplicateWork(requireItem())] }),
    'desk.delete-set': () => { commands.deleteWork(requireItem()); return { kind: 'tool-opened', toolId: 'delete-set-confirmation' }; },
    'desk.manage-location': commands.manageLocation,
    'library.manage-location': () => { commands.openLocation(requireItem()); return { kind: 'tool-opened', toolId: 'locations' }; },
    'library.delete-copy': () => { commands.deleteWork(requireItem()); return { kind: 'tool-opened', toolId: 'delete-copy-confirmation' }; },
    'library.view-source': () => { const item = requireItem(); if (!item.webViewLink) throw new Error('This object has no provider source link.'); window.open(item.webViewLink, '_blank', 'noopener,noreferrer'); return { kind: 'provider-handoff', href: item.webViewLink }; },
  };
  const definitions = descriptors.map((descriptor) => {
    if (descriptor.id === 'desk.send-pipeline' && actionItem?.references.localSetId) {
      return createSendToPipelineActionDefinition({
        id: 'desk.send-pipeline',
        objectKind: 'set',
        sources: descriptor.supportedSources,
        execute: () => commands.openPipeline(actionItem.references.localSetId!),
      });
    }
    const execute = operations[descriptor.id];
    if (!execute) throw new Error(`Desk action ${descriptor.id} has no registered execution owner.`);
    return createActionDefinition(descriptor, async () => execute());
  });
  const runtime = createActionRuntime(definitions);

  return {
    actions: definitions.map((definition) => definition.descriptor),
    detail: inspectorItem ? workDetailRecord(inspectorItem) : null,
    runAction: (action: ActionDescriptor) => {
      const targetIds = actionItem ? [actionItem.references.localSetId ?? actionItem.id] : [];
      void runtime.execute(action.id, { targetIds }).catch((error: unknown) => {
        toast({ title: 'Action could not be completed', description: error instanceof Error ? error.message : 'The selected Desk action is unavailable.', variant: 'destructive' });
      });
    },
  };
}
