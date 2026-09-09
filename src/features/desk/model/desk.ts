import type { DisplayCard } from '@/domain/rendering';
import type { StoredDisplayCard } from '@/domain/cards';
import type { ActionDescriptor, EnvironmentDetailRecord } from '@/features/app-shell/client/environment';
import { createSendToPipelineActionDescriptor } from '@/features/pipeline/client';
import {
  getAccountLibraryActionSources,
  type AccountLibraryItem,
  type AccountLibrarySource,
} from '@/features/storage-management/client';

type LegacyDeskSourceFilter = 'connected' | 'temporary';

export const getDeskToolCard = (
  setCards: readonly StoredDisplayCard[],
  focusedArtifactId: string | null,
  selectedCardIds: readonly string[],
  requestedCardId?: string,
): StoredDisplayCard | undefined => (
  setCards.find((card) => card.uniqueId === requestedCardId)
  ?? setCards.find((card) => card.uniqueId === focusedArtifactId)
  ?? setCards.find((card) => selectedCardIds.includes(card.uniqueId))
  ?? setCards[0]
);
export type DeskSourceFilter = 'all' | AccountLibrarySource | LegacyDeskSourceFilter;
export type DeskWorkKeyboardIntent = 'open' | 'select' | 'select-additive' | 'none';
export const DESK_METADATA_SEPARATOR = ' · ';

export const joinDeskMetadata = (parts: readonly string[]): string => parts.join(DESK_METADATA_SEPARATOR);

export const getDeskWorkKeyboardIntent = (
  key: string,
  additiveModifier: boolean,
): DeskWorkKeyboardIntent => {
  if (key === 'Enter') return 'open';
  if (key === ' ') return additiveModifier ? 'select-additive' : 'select';
  return 'none';
};

export interface DeskAccountStatus {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
}

// Values stay unchanged so existing browser-local Desk layouts migrate without loss.
// These persisted keys predate the Desk noun cut. Keep the strings as narrow
// compatibility reads so existing browser work retains its pins and tab order.
export const DESK_PINS_KEY = 'home-desk-pins';
export const DESK_ORDER_KEY = 'home-desk-order';
export const visibleWorkKinds = new Set<AccountLibraryItem['kind']>(['set', 'working-draft', 'campaign', 'published-resource']);
export interface DeskSourceFacet {
  id: AccountLibrarySource;
  label: string;
  count: number;
}

export interface DeskOrganizationFacet {
  id: string;
  label: string;
  count: number;
}

export const getDeskSourceFacets = (items: readonly AccountLibraryItem[]): DeskSourceFacet[] => {
  const facets = new Map<AccountLibrarySource, DeskSourceFacet>();
  items.forEach((item) => {
    const seenSources = new Set<AccountLibrarySource>();
    item.locations.forEach((location) => {
      if (seenSources.has(location.source)) return;
      seenSources.add(location.source);
      const current = facets.get(location.source);
      facets.set(location.source, {
        id: location.source,
        label: current?.label ?? location.label,
        count: (current?.count ?? 0) + 1,
      });
    });
  });
  return [...facets.values()];
};

const organizationFacets = (values: readonly string[]): DeskOrganizationFacet[] => {
  const counts = new Map<string, DeskOrganizationFacet>();
  values.forEach((value) => {
    const current = counts.get(value);
    counts.set(value, { id: value, label: value, count: (current?.count ?? 0) + 1 });
  });
  return [...counts.values()].toSorted((left, right) => left.label.localeCompare(right.label));
};

export const getDeskTypeFacets = (items: readonly AccountLibraryItem[]): DeskOrganizationFacet[] => organizationFacets(
  items.flatMap((item) => item.organization.type ? [item.organization.type] : []),
);

export const getDeskTagFacets = (items: readonly AccountLibraryItem[]): DeskOrganizationFacet[] => organizationFacets(
  items.flatMap((item) => item.organization.tags),
);

export const normalizeDeskOrder = (
  availableIds: string[],
  storedOrder: string[],
): string[] => {
  const available = new Set(availableIds);
  const admitted = storedOrder.filter((id, index) => available.has(id) && storedOrder.indexOf(id) === index);
  const admittedSet = new Set(admitted);
  return [...admitted, ...availableIds.filter((id) => !admittedSet.has(id))];
};

/**
 * Persisted Desk order is a durable account preference, not a discovery
 * result. Keep identities that are temporarily absent while a provider is
 * loading or unavailable; the visible projection still uses normalizeDeskOrder.
 */
export const preserveDeskOrder = (
  availableIds: string[],
  storedOrder: string[],
): string[] => {
  const stored = storedOrder.filter((id, index) => Boolean(id) && storedOrder.indexOf(id) === index);
  const known = new Set(stored);
  return [...stored, ...availableIds.filter((id) => !known.has(id))];
};

export const workSource = (item: AccountLibraryItem): AccountLibrarySource => (
  item.locations[0]?.source ?? 'device'
);

export const workSourceLabel = (item: AccountLibraryItem): string => (
  item.locations.map((location) => location.label).join(' + ') || 'Unknown source'
);

export const getCardTitle = (card: DisplayCard, index: number): string => String(
  card.data.cardName
    ?? card.data.name
    ?? card.data.title
    ?? `Card ${index + 1}`,
);

export const workDetailRecord = (item: AccountLibraryItem): EnvironmentDetailRecord => ({
  id: item.id,
  kind: 'set',
  eyebrow: 'Work',
  title: item.name,
  summary: joinDeskMetadata(item.details) || 'Ready to continue.',
  status: item.locations.some((location) => location.status === 'needs-permission')
    ? 'Permission required'
    : item.kind === 'working-draft'
      ? 'Temporary work'
      : 'Available',
  tone: item.locations.some((location) => location.status === 'needs-permission') || item.kind === 'working-draft'
    ? 'warning'
    : 'success',
  actionSources: getAccountLibraryActionSources(item),
  meta: [
    ['Source', workSourceLabel(item)],
    ['Contents', joinDeskMetadata(item.details) || 'No content summary'],
    ...(item.revision ? [['Revision', item.revision] as const] : []),
    ...(item.expiresAt ? [['Expires', new Date(item.expiresAt).toLocaleString()] as const] : []),
  ],
});

export const zoneAction = (
  id: ActionDescriptor['id'],
  label: string,
  result: ActionDescriptor['result'] = 'navigation',
): ActionDescriptor => ({
  id,
  label,
  ownerFeature: id === 'desk.create-set' ? 'card-generator' : 'project',
  supportedObjectKinds: [],
  supportedSources: [],
  revisionPolicy: 'none',
  requiredPermission: 'guest',
  scope: 'zone',
  hierarchy: 'primary',
  availability: { kind: 'available' },
  commitment: 'none',
  automation: { kind: 'human-only', owner: 'cardforge' },
  result,
});

export const getWorkActions = (
  item: AccountLibraryItem,
  pinned: boolean,
  canDelete: boolean,
  canContribute = false,
  canUseProjectFiles = false,
): ActionDescriptor[] => {
  const sources = getAccountLibraryActionSources(item).map((source) => source.source);
  const localSet = Boolean(item.references.localSetId);
  const openAutomation: ActionDescriptor['automation'] = item.references.driveFileId
    ? { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] }
    : { kind: 'human-only', owner: 'cardforge' };
  return [
    {
      id: 'desk.open-set', label: localSet ? 'Open Set' : item.references.campaignId ? 'Open campaign workspace' : item.references.pipelineLineageId ? 'Open published work' : item.kind === 'working-draft' ? 'Continue in Studio' : 'Open in Studio', ownerFeature: item.references.campaignId ? 'marketing-content' : item.references.pipelineLineageId ? 'pipeline' : item.kind === 'working-draft' ? 'studio-documents' : 'project',
      supportedObjectKinds: [item.kind], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'primary', availability: { kind: 'available' }, commitment: item.references.driveFileId ? 'permission' : 'none',
      automation: openAutomation, result: item.references.campaignId || item.references.pipelineLineageId ? 'tool-opened' : 'navigation',
    },
    {
      id: 'desk.pin-set', label: pinned ? 'Unpin from desk' : 'Pin to desk', ownerFeature: 'project',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: 'guest',
      scope: 'object', hierarchy: 'supporting', availability: { kind: 'available' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    },
    {
      id: 'desk.generate-set', label: 'Generate cards', ownerFeature: 'card-generator',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'supporting', availability: localSet ? { kind: 'available' } : { kind: 'disabled', reason: 'Open this work on the device before generating cards.' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'tool-opened',
    },
    {
      id: 'desk.export-set', label: 'Output', ownerFeature: 'card-generator',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'overflow', availability: localSet ? { kind: 'available' } : { kind: 'disabled', reason: 'Open this work on the device before exporting it.' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'tool-opened',
    },
    {
      id: 'desk.save-move-set', label: 'Save & move', ownerFeature: 'storage-management',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'supporting', availability: canUseProjectFiles
        ? { kind: 'available' }
        : { kind: 'disabled', reason: 'Creator Pass is required to save or move portable Set files.' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'tool-opened',
    },
    ...(localSet && canContribute ? [createSendToPipelineActionDescriptor({
      id: 'desk.send-pipeline', objectKind: 'set', sources,
    })] : []),
    ...(localSet ? [{
      id: 'desk.rename-set' as const, label: 'Rename', ownerFeature: 'project' as const,
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'tool-opened' as const,
    }, {
      id: 'desk.duplicate-set' as const, label: 'Duplicate', ownerFeature: 'project' as const,
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }, {
      id: 'desk.delete-set' as const, label: 'Delete from this device', ownerFeature: 'project' as const,
      supportedObjectKinds: ['set'], supportedSources: ['browser-local'] as const, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const,
      availability: canDelete ? { kind: 'available' as const } : { kind: 'disabled' as const, reason: 'This Set cannot be deleted right now.' },
      commitment: 'none' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'tool-opened' as const,
    }] : [{
      id: 'desk.manage-location' as const, label: 'Manage source', ownerFeature: 'storage-management' as const,
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }]),
  ];
};

export const matchesSourceFilter = (item: AccountLibraryItem, filter: DeskSourceFilter): boolean => {
  if (filter === 'all') return true;
  const sources = item.locations.map((location) => location.source);
  // Compatibility-only aliases for return contexts created before reflective source facets.
  if (filter === 'temporary') return sources.includes('assistant-draft');
  if (filter === 'connected') return sources.includes('google-drive') || sources.includes('local-folder');
  return sources.includes(filter);
};

export const matchesDeskSourceFilters = (item: AccountLibraryItem, filters: readonly AccountLibrarySource[]): boolean => (
  filters.length === 0 || filters.some((filter) => item.locations.some((location) => location.source === filter))
);

export const matchesDeskTypeFilters = (item: AccountLibraryItem, filters: readonly string[]): boolean => (
  filters.length === 0 || (item.organization.type !== null && filters.includes(item.organization.type))
);

export const matchesDeskTagFilters = (
  item: AccountLibraryItem,
  filters: readonly string[],
  match: 'any' | 'all',
): boolean => {
  if (filters.length === 0) return true;
  const tags = new Set(item.organization.tags);
  return match === 'all' ? filters.every((tag) => tags.has(tag)) : filters.some((tag) => tags.has(tag));
};

export const matchesDeskViews = (item: AccountLibraryItem, viewIds: readonly string[]): boolean => {
  if (viewIds.includes('my-work') && (item.organization.publicationState === 'working' || item.organization.publicationState === 'temporary')) return true;
  if (viewIds.includes('campaigns') && item.organization.publicationState === 'campaign') return true;
  return viewIds.includes('my-published') && item.organization.publicationState === 'published';
};
