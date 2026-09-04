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
export const visibleWorkKinds = new Set<AccountLibraryItem['kind']>(['set', 'working-draft']);
export interface DeskSourceFacet {
  id: AccountLibrarySource;
  label: string;
  count: number;
}

export const getDeskSourceFacets = (items: readonly AccountLibraryItem[]): DeskSourceFacet[] => {
  const facets = new Map<AccountLibrarySource, DeskSourceFacet>();
  items.forEach((item) => item.locations.forEach((location) => {
    const current = facets.get(location.source);
    facets.set(location.source, {
      id: location.source,
      label: current?.label ?? location.label,
      count: (current?.count ?? 0) + 1,
    });
  }));
  return [...facets.values()];
};

export const normalizeDeskOrder = (
  availableIds: string[],
  storedOrder: string[],
): string[] => {
  const available = new Set(availableIds);
  const admitted = storedOrder.filter((id, index) => available.has(id) && storedOrder.indexOf(id) === index);
  const admittedSet = new Set(admitted);
  return [...admitted, ...availableIds.filter((id) => !admittedSet.has(id))];
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
  summary: item.details.join(' · ') || 'Ready to continue.',
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
    ['Contents', item.details.join(' · ') || 'No content summary'],
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
      id: 'desk.open-set', label: localSet ? 'Open Set' : item.kind === 'working-draft' ? 'Continue in Studio' : 'Open in Studio', ownerFeature: item.kind === 'working-draft' ? 'studio-documents' : 'project',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'primary', availability: { kind: 'available' }, commitment: item.references.driveFileId ? 'permission' : 'none',
      automation: openAutomation, result: 'navigation',
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
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    },
    {
      id: 'desk.export-set', label: 'Export / print', ownerFeature: 'card-generator',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'overflow', availability: localSet ? { kind: 'available' } : { kind: 'disabled', reason: 'Open this work on the device before exporting it.' }, commitment: 'none',
      automation: { kind: 'planned-mcp', capability: 'export a selected Set with explicit output settings' }, result: 'navigation',
    },
    {
      id: 'desk.save-move-set', label: 'Save / move', ownerFeature: 'storage-management',
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'supporting', availability: canUseProjectFiles
        ? { kind: 'available' }
        : { kind: 'disabled', reason: 'Creator Pass is required to save or move portable Set files.' }, commitment: 'permission',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    },
    ...(localSet && canContribute ? [createSendToPipelineActionDescriptor({
      id: 'desk.send-pipeline', objectKind: 'set', sources,
    })] : []),
    ...(localSet ? [{
      id: 'desk.rename-set' as const, label: 'Rename', ownerFeature: 'project' as const,
      supportedObjectKinds: ['set'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
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
      commitment: 'destructive' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
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
