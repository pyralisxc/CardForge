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
  item.kind === 'set' ? 'card-generator' : 'project'
);

const openPermission = (item: AccountLibraryItem): ActionPermission => (
  item.references.localSetId ? 'guest' : 'creator'
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
  disabledReason?: string,
): ActionDescriptor[] => {
  const availableActions = getAccountLibraryAvailableActions(item);
  const sources = getAccountLibraryActionSources(item).map((source) => source.source);
  const availability = disabledReason
    ? { kind: 'disabled', reason: disabledReason } as const
    : { kind: 'available' } as const;
  const actions: ActionDescriptor[] = [];

  if (availableActions.includes('continue')) {
    actions.push({
      id: 'library.continue',
      label: 'Continue in Studio',
      ownerFeature: 'studio-documents',
      supportedObjectKinds: [item.kind],
      supportedSources: sources,
      revisionPolicy: 'current-required',
      requiredPermission: 'creator',
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
      label: item.references.localSetId ? 'Open in Studio' : 'Open project',
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
      availability,
      commitment: item.references.driveFileId ? 'permission' : 'none',
      automation: openAutomation(item),
      result: 'navigation',
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
      requiredPermission: 'creator',
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
      requiredPermission: item.references.localFolder ? 'guest' : 'creator',
      scope: 'object',
      hierarchy: actions.length === 0 ? 'primary' : 'overflow',
      availability,
      commitment: 'none',
      automation: human(),
      result: 'navigation',
    });
  }

  return actions;
};
