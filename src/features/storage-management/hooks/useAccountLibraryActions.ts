"use client";

import type { Dispatch, SetStateAction } from 'react';

import { useToast } from '@/components/ui/use-toast';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import {
  createActionRuntime,
  type ActionDescriptor,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref } from '@/features/app-shell/client/navigation';
import { createSendToPipelineActionDescriptor, type PipelineSubmission } from '@/features/pipeline/client';
import { createPublishedSetCopy, useProjectStore } from '@/features/project/client';

import type { AccountLibraryItem } from '../model/accountLibrary';
import { getAccountLibraryEnvironmentActions } from '../model/accountLibraryEnvironment';
import {
  createAccountLibraryActionDefinitions,
  createLibraryLocationsHref,
  type AccountLibraryActionCommands,
} from '../lib/accountLibraryActions';
import type { LibraryScope } from '../model/libraryScopes';
import type { useAccountLibraryProjection } from './useAccountLibraryProjection';
import {
  createLibraryZoneAction as zoneAction,
  getSharedLibraryActions as sharedActions,
  type LibraryViewItem,
} from '../components/LibraryObjectPresentation';

type LibraryTool = 'locations' | 'contribute' | 'edit-contribution' | 'design' | null;
type AccountLibraryProjection = Pick<ReturnType<typeof useAccountLibraryProjection>, 'busyItemId' | 'openItem' | 'refresh' | 'router'>;
type CommandTarget = LibraryViewItem | { scope: 'personal'; id: string; personal: AccountLibraryItem } | null;

interface UseAccountLibraryActionsOptions {
  activeLoading: boolean;
  activeScope: LibraryScope;
  activeTool: LibraryTool;
  closeDetail: () => void;
  createCompatibilityReturnTo: () => string;
  currentItem: LibraryViewItem | null;
  designReturnFocusId: string | null;
  editingSubmission: PipelineSubmission | null;
  experience: AccountExperienceProjection;
  openContributionTool: (options?: { setId?: string | null }) => void;
  projection: AccountLibraryProjection;
  refresh: () => void;
  setActiveTool: Dispatch<SetStateAction<LibraryTool>>;
  setDesignReturnFocusId: Dispatch<SetStateAction<string | null>>;
  setEditingSubmission: Dispatch<SetStateAction<PipelineSubmission | null>>;
  setLocationItem: Dispatch<SetStateAction<AccountLibraryItem | null>>;
  setPendingDeleteItem: Dispatch<SetStateAction<AccountLibraryItem | null>>;
}

export function useAccountLibraryActions({
  activeLoading,
  activeScope,
  activeTool,
  closeDetail,
  createCompatibilityReturnTo,
  currentItem,
  designReturnFocusId,
  editingSubmission,
  experience,
  openContributionTool,
  projection,
  refresh,
  setActiveTool,
  setDesignReturnFocusId,
  setEditingSubmission,
  setLocationItem,
  setPendingDeleteItem,
}: UseAccountLibraryActionsOptions) {
  const { toast } = useToast();

  const personalActions = (item: AccountLibraryItem): ActionDescriptor[] => [
    ...getAccountLibraryEnvironmentActions(item, {
      disabledReason: projection.busyItemId !== null ? 'Finish the current Library action first.' : undefined,
      canUseProjectFiles: experience.capabilities.canUseProjectFiles,
    }),
    ...(experience.contributor.canSubmit && item.references.localSetId ? [createSendToPipelineActionDescriptor({
      id: 'library.send-pipeline', objectKind: 'set', sources: ['browser-local'],
    })] : []),
  ];

  const openDesignTool = (templateId: string, focusReturnId: string) => {
    const store = useProjectStore.getState();
    store.setTemplateEditorSelectedTemplateId(templateId);
    store.setStudioView('template');
    setDesignReturnFocusId(focusReturnId);
    setActiveTool('design');
    closeDetail();
    const params = new URLSearchParams({ section: 'library', scope: activeScope, tool: 'design', artifact: templateId });
    const href = `/account?${params.toString()}`;
    projection.router.replace(href);
    return href;
  };

  const actions: ActionDescriptor[] = activeTool
    ? [zoneAction(activeTool === 'locations' ? 'library.close-locations' : 'library.close-tool', activeTool === 'locations' ? 'Close locations' : activeTool === 'edit-contribution' ? 'Close submission editor' : activeTool === 'design' ? 'Close Design' : 'Close contribution tool')]
    : currentItem?.scope === 'personal'
      ? personalActions(currentItem.personal)
      : currentItem?.scope === 'published' || currentItem?.scope === 'pipeline' ? sharedActions(currentItem)
        : [zoneAction('library.refresh', activeLoading ? 'Refreshing' : 'Refresh Library', activeLoading)];

  const openPersonalItem = (item: AccountLibraryItem) => {
    if (item.references.localSetId) {
      const href = createDeskReturnHref(`set:${item.references.localSetId}`);
      projection.router.push(href);
      return href;
    }
    if (item.references.localTemplateId) return openDesignTool(item.references.localTemplateId, `library-object-${item.id}`);
    const returnTo = createCompatibilityReturnTo();
    void projection.openItem(item, returnTo);
    return returnTo;
  };

  const duplicatePersonalItem = (item: AccountLibraryItem) => {
    if (!item.references.localSetId && !item.references.localTemplateId) throw new Error('This Library object cannot be duplicated locally.');
    const duplicateId = item.references.localSetId
      ? useProjectStore.getState().duplicateCardSet(item.references.localSetId)
      : useProjectStore.getState().cloneTemplate(item.references.localTemplateId!);
    if (!duplicateId) throw new Error('CardForge could not create an independent device copy.');
    toast({ title: `${item.kind === 'template' ? 'Template' : 'Set'} duplicated`, description: `${item.name} now has an independent device copy.` });
    projection.refresh();
  };

  const runPublishedAction = async (item: Extract<LibraryViewItem, { scope: 'published' }>, copyTemplate: boolean) => {
    if (item.published.kind === 'set' && item.published.packageUrl) {
      if (copyTemplate) throw new Error('Published Sets create an independent Set rather than a Template copy.');
      const result = await createPublishedSetCopy({ packageUrl: item.published.packageUrl, expectedName: item.name });
      toast({ title: 'Set created', description: `${result.setName} is now independent browser work with ${result.cardCount} card${result.cardCount === 1 ? '' : 's'}.` });
      projection.refresh();
      const href = createDeskReturnHref(`set:${result.setId}`);
      projection.router.push(href);
      return href;
    }
    const template = item.published.template;
    if (!template) throw new Error('This published object does not provide a contextual editor or a Set package.');
    const store = useProjectStore.getState();
    const publishedTemplateId = store.addOrUpdateTemplate(template, 'default');
    const selectedTemplateId = copyTemplate ? store.cloneTemplate(publishedTemplateId) : publishedTemplateId;
    if (!selectedTemplateId) throw new Error('CardForge could not prepare this Template for Design.');
    if (copyTemplate) toast({ title: 'Editable copy created', description: `${item.name} is now in your personal Templates.` });
    return openDesignTool(selectedTemplateId, `library-object-${item.id}`);
  };

  const closeLibraryTool = (locations: boolean) => {
    const focusId = locations
      ? 'library-locations-trigger'
      : activeTool === 'edit-contribution' && editingSubmission
        ? `library-object-pipeline:${editingSubmission.targetRegistryAssetId ?? editingSubmission.registryAssetId ?? editingSubmission.id}`
        : activeTool === 'design' ? designReturnFocusId : 'library-contribute-trigger';
    setActiveTool(null);
    setEditingSubmission(null);
    setDesignReturnFocusId(null);
    const href = `/account?section=library&scope=${activeScope}`;
    projection.router.replace(href);
    requestAnimationFrame(() => { if (focusId) document.getElementById(focusId)?.focus(); });
    return href;
  };

  const openLocations = () => {
    setActiveTool('locations');
    closeDetail();
    const href = createLibraryLocationsHref(activeScope);
    projection.router.replace(href);
    return href;
  };

  const commandsFor = (target: CommandTarget): AccountLibraryActionCommands => {
    const personal = target?.scope === 'personal' ? target.personal : null;
    const published = target?.scope === 'published' ? target : null;
    const pipeline = target?.scope === 'pipeline' ? target : null;
    const requirePersonal = () => { if (!personal) throw new Error('Choose a Personal Library object first.'); return personal; };
    const requirePublished = () => { if (!published) throw new Error('Choose a Published Library object first.'); return published; };
    const requirePipeline = () => { if (!pipeline) throw new Error('Choose a Pipeline revision first.'); return pipeline; };
    return {
      closeLocations: () => closeLibraryTool(true),
      closeTool: () => closeLibraryTool(false),
      continuePersonal: () => openPersonalItem(requirePersonal()),
      openPersonal: () => openPersonalItem(requirePersonal()),
      sendPipeline: () => {
        const item = requirePersonal();
        if (!item.references.localSetId) throw new Error('Choose a local Set before sending work to Pipeline.');
        openContributionTool({ setId: item.references.localSetId });
      },
      saveMove: () => { setLocationItem(requirePersonal()); },
      duplicate: () => duplicatePersonalItem(requirePersonal()),
      deleteCopy: () => { setPendingDeleteItem(requirePersonal()); },
      viewSource: () => {
        const item = requirePersonal();
        if (!item.webViewLink) throw new Error('This Library object has no provider source link.');
        window.open(item.webViewLink, '_blank', 'noopener,noreferrer');
        return item.webViewLink;
      },
      manageLocation: openLocations,
      usePublished: () => runPublishedAction(requirePublished(), false),
      copyPublishedTemplate: () => runPublishedAction(requirePublished(), true),
      editPipeline: () => {
        const item = requirePipeline();
        setEditingSubmission(item.pipeline.submission);
        setActiveTool('edit-contribution');
        closeDetail();
      },
      testPipeline: () => {
        const item = requirePipeline();
        if (!item.pipeline.template) throw new Error('This Pipeline revision has no Template to test.');
        const templateId = useProjectStore.getState().addOrUpdateTemplate(item.pipeline.template, 'user');
        if (!templateId) throw new Error('CardForge could not prepare this exact revision for Design.');
        toast({ title: 'Exact Pipeline revision prepared', description: `${item.name} is open as a local test copy. The shared revision is unchanged.` });
        return openDesignTool(templateId, `library-object-${item.id}`);
      },
      refresh: () => { refresh(); },
    };
  };

  const executeAction = (action: ActionDescriptor, target: CommandTarget, descriptors: readonly ActionDescriptor[]) => {
    const runtime = createActionRuntime(createAccountLibraryActionDefinitions(descriptors, commandsFor(target)));
    const targetId = target?.scope === 'personal' ? target.personal.id : target?.id;
    void runtime.execute(action.id, { targetIds: targetId ? [targetId] : [] }).catch((error: unknown) => {
      toast({ title: 'Library action could not be completed', description: error instanceof Error ? error.message : 'The selected Library action is unavailable.', variant: 'destructive' });
    });
  };

  const runPersonalAction = (actionId: string, item: AccountLibraryItem) => {
    const descriptors = personalActions(item);
    const action = descriptors.find((candidate) => candidate.id === actionId);
    if (action) executeAction(action, { scope: 'personal', id: item.id, personal: item }, descriptors);
  };

  const runPublishedRowAction = (actionId: string, item: Extract<LibraryViewItem, { scope: 'published' }>) => {
    const descriptors = sharedActions(item);
    const action = descriptors.find((candidate) => candidate.id === actionId);
    if (action) executeAction(action, item, descriptors);
  };

  return {
    actions,
    openLocations,
    personalActions,
    runAction: (action: ActionDescriptor) => executeAction(action, currentItem, actions),
    runPersonalAction,
    runPublishedRowAction,
  };
}
