import type {
  ActionAutomation,
  ActionDescriptor,
  ActionPermission,
  ActionSource,
  ActionSourceContext,
  FeatureOwnerId,
} from '@/features/app-shell/client/environment';

import {
  getAccountLibraryAvailableActions,
  type AccountLibraryItem,
  type AccountLibrarySource,
} from './accountLibrary';

const sourceMap: Record<AccountLibrarySource, ActionSource> = {
  device: 'browser-local',
  'google-drive': 'google-drive',
  'local-folder': 'local-folder',
  'assistant-draft': 'temporary',
};

const human = (owner: 'cardforge' | 'provider' = 'cardforge'): ActionAutomation => ({
  kind: 'human-only',
  owner,
});

const openAutomation = (item: AccountLibraryItem): ActionAutomation => {
  if (item.references.localSetId) {
    return human();
  }
  if (item.references.driveFileId) {
    return { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] };
  }
  return human();
};

const openOwner = (item: AccountLibraryItem): FeatureOwnerId => (
  item.references.localSetId ? 'project' : item.kind === 'working-draft' ? 'studio-documents' : item.kind === 'template' ? 'template-editor' : 'card-generator'
);

const openPermission = (item: AccountLibraryItem): ActionPermission => (
  item.references.localSetId || item.references.localTemplateId ? 'guest' : 'member'
);

export const getAccountLibraryActionSources = (item: AccountLibraryItem): ActionSourceContext[] => (
  item.locations.map((location, index) => ({
    id: `${item.id}:${location.source}:${index}`,
    label: location.label,
    source: sourceMap[location.source],
    currentRevisionAvailable: location.source === 'device' || item.revision !== null,
  }))
);

export const getAccountLibraryEnvironmentActions = (
  item: AccountLibraryItem,
  options: {
    disabledReason?: string;
    canUseProjectFiles?: boolean;
  } = {},
): ActionDescriptor[] => {
  const { disabledReason, canUseProjectFiles = true } = options;
  const availableActions = getAccountLibraryAvailableActions(item);
  const sources = getAccountLibraryActionSources(item).map((source) => source.source);
  const availability = disabledReason
    ? { kind: 'disabled', reason: disabledReason } as const
    : { kind: 'available' } as const;
  const projectFileAvailability = disabledReason
    ? availability
    : canUseProjectFiles
      ? availability
      : { kind: 'disabled', reason: 'Creator Pass is required to use portable Set files and connected project locations.' } as const;
  const actions: ActionDescriptor[] = [];

  if (availableActions.includes('continue')) {
    actions.push({
      id: 'library.continue',
      label: 'Continue in Studio',
      ownerFeature: 'studio-documents',
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      revisionPolicy: 'current-required',
      requiredPermission: 'member',
      scope: 'object',
      hierarchy: 'primary',
      availability,
      commitment: 'none',
      automation: human(),
      result: 'navigation',
    });
  }

  if (availableActions.includes('open')) {
    actions.push({
      id: 'library.open',
      label: item.references.localSetId ? 'Open on Desk' : item.references.localTemplateId ? 'Open in Studio' : 'Open project',
      ownerFeature: openOwner(item),
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      // Opening checks out the provider's current revision; it does not require the
      // Library index to have already resolved one. Keep the authored-work path
      // available when a provider row is otherwise readable.
      revisionPolicy: 'none',
      requiredPermission: openPermission(item),
      scope: 'object',
      hierarchy: 'primary',
      availability: item.references.localSetId || item.references.localTemplateId ? availability : projectFileAvailability,
      commitment: item.references.driveFileId ? 'permission' : 'none',
      automation: openAutomation(item),
      result: 'navigation',
    });
  }

  if (availableActions.includes('save-move')) {
    actions.push({
      id: 'library.save-move',
      label: 'Save & move',
      ownerFeature: 'storage-management',
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      revisionPolicy: 'none',
      requiredPermission: item.references.localSetId ? 'guest' : 'member',
      scope: 'object',
      hierarchy: 'supporting',
      availability: projectFileAvailability,
      commitment: 'permission',
      automation: human(),
      result: 'mutation',
    });
  }

  if (availableActions.includes('duplicate')) {
    actions.push({
      id: 'library.duplicate', label: 'Duplicate', ownerFeature: 'card-generator',
      supportedObjectKinds: [item.kind], supportedSources: sources, revisionPolicy: 'none', requiredPermission: 'guest',
      scope: 'object', hierarchy: 'overflow', availability, commitment: 'none', automation: human(), result: 'mutation',
    });
  }

  if (availableActions.includes('view-source')) {
    actions.push({
      id: 'library.view-source',
      label: 'View source',
      ownerFeature: item.references.personalAssetId ? 'personal-library' : 'project',
      supportedObjectKinds: [item.kind],
      supportedSources: ['google-drive'],
      revisionPolicy: 'none',
      requiredPermission: 'member',
      scope: 'object',
      hierarchy: actions.length === 0 ? 'primary' : 'supporting',
      availability,
      commitment: 'none',
      automation: human('provider'),
      result: 'provider-handoff',
    });
  }

  if (availableActions.includes('manage-storage')) {
    actions.push({
      id: 'library.manage-location',
      label: 'Manage locations',
      ownerFeature: 'storage-management',
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      revisionPolicy: 'none',
      requiredPermission: item.references.localFolder ? 'guest' : 'member',
      scope: 'object',
      hierarchy: actions.length === 0 ? 'primary' : 'overflow',
      availability,
      commitment: 'none',
      automation: human(),
      result: 'navigation',
    });
  }

  if (availableActions.includes('delete-copy')) {
    actions.push({
      id: 'library.delete-copy',
      label: item.references.localSetId || item.references.localTemplateId ? 'Delete device copy' : 'Delete Drive copy',
      ownerFeature: item.references.localTemplateId ? 'template-editor' : item.references.localSetId ? 'card-generator' : 'project',
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      revisionPolicy: item.references.driveFileId && !item.references.localSetId ? 'conflict-safe' : 'none',
      requiredPermission: item.references.localSetId || item.references.localTemplateId ? 'guest' : 'member',
      scope: 'object', hierarchy: 'overflow', availability, commitment: 'destructive', automation: human(item.references.driveFileId && !item.references.localSetId && !item.references.localTemplateId ? 'provider' : 'cardforge'), result: 'mutation',
    });
  }

  return actions;
};
