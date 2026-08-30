import type { DisplayCard } from '@/domain/rendering';
import type { ActionDescriptor, EnvironmentDetailRecord } from '@/features/app-shell/client/environment';
import {
  getAccountLibraryActionSources,
  type AccountLibraryItem,
  type AccountLibrarySource,
} from '@/features/storage-management/client';

export type HomeSourceFilter = 'all' | 'device' | 'connected' | 'temporary';
export type HomeSort = 'desk' | 'name' | 'size';

export const HOME_PINS_KEY = 'home-desk-pins';
export const HOME_ORDER_KEY = 'home-desk-order';
export const visibleWorkKinds = new Set<AccountLibraryItem['kind']>(['set', 'working-draft']);
export const sourceFilterOptions: Array<{ id: HomeSourceFilter; label: string }> = [
  { id: 'all', label: 'All work' },
  { id: 'device', label: 'Device' },
  { id: 'connected', label: 'Connected' },
  { id: 'temporary', label: 'Temporary' },
];

export const normalizeDeskOrder = (
  availableIds: string[],
  storedOrder: string[],
): string[] => {
  const available = new Set(availableIds);
  const admitted = storedOrder.filter((id, index) => available.has(id) && storedOrder.indexOf(id) === index);
  const admittedSet = new Set(admitted);
  return [...admitted, ...availableIds.filter((id) => !admittedSet.has(id))];
};

export const reorderDeskItem = (
  order: string[],
  itemId: string,
  target: string | 'earlier' | 'later',
): string[] => {
  const currentIndex = order.indexOf(itemId);
  if (currentIndex < 0) return order;
  const targetIndex = target === 'earlier'
    ? Math.max(0, currentIndex - 1)
    : target === 'later'
      ? Math.min(order.length - 1, currentIndex + 1)
      : order.indexOf(target);
  if (targetIndex < 0 || targetIndex === currentIndex) return order;
  const next = [...order];
  next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, itemId);
  return next;
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
  kind: 'home-work',
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
  ownerFeature: id === 'home.create-work' ? 'card-generator' : 'project',
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
      id: 'home.open-work', label: 'Open in Studio', ownerFeature: item.kind === 'working-draft' ? 'studio-documents' : 'project',
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'primary', availability: { kind: 'available' }, commitment: item.references.driveFileId ? 'permission' : 'none',
      automation: openAutomation, result: 'navigation',
    },
    {
      id: 'home.pin-work', label: pinned ? 'Unpin from desk' : 'Pin to desk', ownerFeature: 'project',
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: 'guest',
      scope: 'object', hierarchy: 'supporting', availability: { kind: 'available' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    },
    {
      id: 'home.generate-work', label: 'Generate cards', ownerFeature: 'card-generator',
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'supporting', availability: localSet ? { kind: 'available' } : { kind: 'disabled', reason: 'Open this work on the device before generating cards.' }, commitment: 'none',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
    },
    {
      id: 'home.export-work', label: 'Export / print', ownerFeature: 'card-generator',
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'overflow', availability: localSet ? { kind: 'available' } : { kind: 'disabled', reason: 'Open this work on the device before exporting it.' }, commitment: 'none',
      automation: { kind: 'planned-mcp', capability: 'export a selected Set with explicit output settings' }, result: 'navigation',
    },
    {
      id: 'home.save-move-work', label: 'Save / move', ownerFeature: 'storage-management',
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none', requiredPermission: localSet ? 'guest' : 'member',
      scope: 'object', hierarchy: 'supporting', availability: canUseProjectFiles
        ? { kind: 'available' }
        : { kind: 'disabled', reason: 'Creator Pass is required to save or move portable Set files.' }, commitment: 'permission',
      automation: { kind: 'human-only', owner: 'cardforge' }, result: 'mutation',
    },
    ...(localSet && canContribute ? [{
      id: 'home.send-pipeline' as const, label: 'Send to Pipeline', ownerFeature: 'pipeline' as const,
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'contributor' as const,
      scope: 'object' as const, hierarchy: 'supporting' as const, availability: { kind: 'available' as const }, commitment: 'publication' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }] : []),
    ...(localSet ? [{
      id: 'home.rename-work' as const, label: 'Rename', ownerFeature: 'project' as const,
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }, {
      id: 'home.duplicate-work' as const, label: 'Duplicate', ownerFeature: 'project' as const,
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }, {
      id: 'home.delete-work' as const, label: 'Delete from this device', ownerFeature: 'project' as const,
      supportedObjectKinds: ['home-work'], supportedSources: ['browser-local'] as const, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const,
      availability: canDelete ? { kind: 'available' as const } : { kind: 'disabled' as const, reason: 'Keep at least one local Set on this device.' },
      commitment: 'destructive' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }] : [{
      id: 'home.manage-location' as const, label: 'Manage source', ownerFeature: 'storage-management' as const,
      supportedObjectKinds: ['home-work'], supportedSources: sources, revisionPolicy: 'none' as const, requiredPermission: 'guest' as const,
      scope: 'object' as const, hierarchy: 'overflow' as const, availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }]),
  ];
};

export const matchesSourceFilter = (item: AccountLibraryItem, filter: HomeSourceFilter): boolean => {
  if (filter === 'all') return true;
  const sources = item.locations.map((location) => location.source);
  if (filter === 'device') return sources.includes('device') || sources.includes('local-folder');
  if (filter === 'temporary') return sources.includes('assistant-draft');
  return sources.includes('google-drive');
};
