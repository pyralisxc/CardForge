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
  focusWork: (item: AccountLibraryItem) => void;
  openRemoteWork: (item: AccountLibraryItem) => void | Promise<void>;
  togglePin: (itemId: string) => void;
  openGenerate: (setId: string) => void;
  openOutput: (setId: string) => void;
  openLocation: (item: AccountLibraryItem) => void;
  openPipeline: (setId: string) => void;
  renameWork: (item: AccountLibraryItem) => void;
  duplicateWork: (item: AccountLibraryItem) => void;
  deleteWork: (item: AccountLibraryItem) => void;
  manageLocation: () => void;
}

interface DeskActionRuntimeOptions {
  experience: AccountExperienceProjection;
  focusedItem: AccountLibraryItem | null;
  inspectorItem: AccountLibraryItem | null;
  pinned: boolean;
  commands: DeskActionCommands;
  navigationHref: (actionId: ActionDescriptor['id'], item: AccountLibraryItem | null) => string;
}

export function useDeskActionRuntime({
  experience,
  focusedItem,
  inspectorItem,
  pinned,
  commands,
  navigationHref,
}: DeskActionRuntimeOptions) {
  const { toast } = useToast();
  const actionItem = inspectorItem ?? focusedItem;
  const descriptors: ActionDescriptor[] = inspectorItem
    ? getWorkActions(inspectorItem, pinned, true, experience.contributor.canSubmit, experience.capabilities.canUseProjectFiles)
    : focusedItem ? [] : [zoneAction('desk.create-set', 'New Set', 'mutation')];
  const mutationResult = (targetIds: string[]): ActionOperationResult => ({ kind: 'mutation', changedIds: targetIds });
  const operations: Record<string, () => void | Promise<void>> = {
    'desk.create-set': commands.createWork,
    'desk.open-set': () => {
      if (!actionItem) return;
      return actionItem.references.localSetId ? commands.focusWork(actionItem) : commands.openRemoteWork(actionItem);
    },
    'desk.pin-set': () => { if (inspectorItem) commands.togglePin(inspectorItem.id); },
    'desk.generate-set': () => { if (actionItem?.references.localSetId) commands.openGenerate(actionItem.references.localSetId); },
    'desk.export-set': () => { if (actionItem?.references.localSetId) commands.openOutput(actionItem.references.localSetId); },
    'desk.save-move-set': () => { if (actionItem) commands.openLocation(actionItem); },
    'desk.rename-set': () => { if (inspectorItem?.references.localSetId) commands.renameWork(inspectorItem); },
    'desk.duplicate-set': () => { if (inspectorItem) commands.duplicateWork(inspectorItem); },
    'desk.delete-set': () => { if (inspectorItem) commands.deleteWork(inspectorItem); },
    'desk.manage-location': commands.manageLocation,
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
    return createActionDefinition(descriptor, async (input) => {
      await execute();
      return descriptor.result === 'navigation'
        ? { kind: 'navigation', href: navigationHref(descriptor.id, actionItem) }
        : mutationResult(input.targetIds);
    });
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
