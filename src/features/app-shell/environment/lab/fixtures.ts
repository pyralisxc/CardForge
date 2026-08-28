import {
  Archive,
  Box,
  Boxes,
  CreditCard,
  FileCheck2,
  FileText,
  HardDrive,
  Image as ImageIcon,
  LockKeyhole,
  Package,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';

import type { ActionDescriptor, ActionRevisionPolicy, ActionSource, ActionSourceContext, EnvironmentBoundaryState, ZoneId } from '../model';
import type { CollectionItem, DetailRecord, QueueItem, RecipeId, SettingItem, StudioArtifact } from './types';

export const recipeZones: Record<RecipeId, ZoneId> = {
  home: 'home', collection: 'library', profile: 'profile', queue: 'owner', studio: 'studio',
};

export const recipeLabels: Record<RecipeId, { eyebrow: string; title: string; body: string }> = {
  home: { eyebrow: 'Flow recipe', title: 'Welcome back, Cameron', body: 'Resume current work, scan account truth, and continue without a wall of dashboard cards.' },
  collection: { eyebrow: 'Collection recipe', title: 'Library', body: 'One inventory across available locations, with source and durability kept visible.' },
  profile: { eyebrow: 'Profile recipe', title: 'Cameron', body: 'Identity, personal continuity, and provider-native controls expressed as compact grouped rows.' },
  queue: { eyebrow: 'Queue recipe', title: 'Action Center', body: 'Role-aware work that needs review, intervention, or accountable follow-up.' },
  studio: { eyebrow: 'Spatial recipe', title: 'Arcane Playing Deck', body: 'One active Set Desk with stable objects, groups, selection scope, and context-preserving tools.' },
};

const sourceContext = (source: ActionSource, label: string, currentRevisionAvailable = true): ActionSourceContext => ({
  id: `${source}-${label.toLowerCase().replaceAll(' ', '-')}`,
  label,
  source,
  currentRevisionAvailable,
});

const withActionContext = <T extends object>(record: T, actionSources: ActionSourceContext | readonly ActionSourceContext[]): T & Pick<DetailRecord, 'actionSources'> => ({
  ...record,
  actionSources: Array.isArray(actionSources) ? actionSources : [actionSources],
});

export const homeCurrentWork: SettingItem = {
  id: 'home-current-work', kind: 'set', eyebrow: 'Current work', title: 'Arcane Playing Deck',
  summary: '54 cards · This device + Google Drive', value: 'Resume', status: 'Saved moments ago', tone: 'success', icon: Boxes,
  actionSources: [sourceContext('browser-local', 'This device'), sourceContext('google-drive', 'Google Drive')],
  meta: [['Kind', 'Set'], ['Revision', 'v0.3'], ['Locations', 'This device · Google Drive'], ['Next action', 'Resume in Studio']],
};

export const homeSnapshotItems: readonly SettingItem[] = ([
  { id: 'home-plan', kind: 'account-plan', eyebrow: 'Plan', title: 'Plan', summary: 'Product access and output policy', value: 'Free', status: 'Active', tone: 'success', icon: CreditCard, meta: [['Plan', 'Free'], ['Temporary work', '12-hour inactivity window'], ['Clean export', 'Upgrade required'], ['Management', 'Compare plans']] },
  { id: 'home-storage', kind: 'storage-summary', eyebrow: 'Storage', title: 'Storage', summary: 'Work across known locations', value: '5 items · 3 sources', status: 'Available', tone: 'success', icon: HardDrive, meta: [['This device', '3 items'], ['Google Drive', '2 projects'], ['Temporary drafts', '1 expiring'], ['Management', 'Open Library locations']] },
  { id: 'home-connections', kind: 'connection-summary', eyebrow: 'Connections', title: 'Connections', summary: 'Provider-native durable storage', value: 'Drive connected', status: 'Connected', tone: 'success', icon: RefreshCw, meta: [['Google Drive', 'Connected'], ['Local folder', 'Attached'], ['Last check', '4 minutes ago'], ['Management', 'Open connection controls']] },
  { id: 'home-security', kind: 'security-summary', eyebrow: 'Security', title: 'Security', summary: 'Identity and session protection', value: 'Protected', status: 'No action needed', tone: 'success', icon: ShieldCheck, meta: [['Identity owner', 'Clerk'], ['Two-factor authentication', 'Enabled'], ['Active sessions', '2'], ['Management', 'Open native security controls']] },
] as const satisfies ReadonlyArray<Omit<SettingItem, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('provider-native', 'CardForge account')));

export const collectionItems: readonly CollectionItem[] = ([
  { id: 'arcane-deck', kind: 'set', eyebrow: 'Set', title: 'Arcane Playing Deck', summary: 'Classic Edition · 54 coordinated cards', location: 'This device + Drive', updated: 'Today, 9:15 AM', status: 'Available', tone: 'success', icon: Boxes, meta: [['Revision', 'v0.3'], ['Locations', 'This device · Google Drive'], ['Dependencies', '3 reviewed assets'], ['Last action', 'Generated card variants']] },
  { id: 'tarot-guide', kind: 'project', eyebrow: 'Project', title: 'Tarot Companion Guide', summary: 'Rulebook and reference project', location: 'Google Drive', updated: 'May 12, 2026', status: 'Permission ready', tone: 'success', icon: FileText, meta: [['Revision', 'v0.2'], ['Location', 'Google Drive · Tarot Projects'], ['Permission', 'Read and write'], ['Recovery', 'Portable package available']] },
  { id: 'classic-frame', kind: 'template', eyebrow: 'Template', title: 'Card Frame — Classic', summary: 'Reusable Games Template', location: 'This device', updated: 'Apr 30, 2026', status: 'Ready', tone: 'neutral', icon: ImageIcon, meta: [['Revision', 'v1.2'], ['Location', 'This device'], ['Used by', '2 Sets'], ['Compatibility', 'Games · Playing cards']] },
  { id: 'ai-draft', kind: 'temporary-draft', eyebrow: 'Temporary AI draft', title: 'Tarot Frame Study', summary: 'Private working document', location: 'Temporary workspace', updated: 'Today, 11:02 AM', status: 'Expires in 6h', tone: 'warning', icon: Sparkles, meta: [['Revision', 'v4'], ['Retention', 'Expires in 6 hours'], ['Durability', 'Temporary — not a backup'], ['Next action', 'Save to device or Drive']] },
] as const satisfies ReadonlyArray<Omit<CollectionItem, 'actionSources'>>).map((record) => withActionContext(
  record,
  record.kind === 'set'
    ? [sourceContext('browser-local', 'This device'), sourceContext('google-drive', 'Google Drive')]
    : record.kind === 'project'
      ? sourceContext('google-drive', 'Google Drive')
      : record.kind === 'temporary-draft'
        ? sourceContext('temporary', 'Temporary workspace')
        : sourceContext('browser-local', 'This device'),
));

export const profileGroups: ReadonlyArray<{ title: string; items: readonly SettingItem[] }> = [
  { title: 'Identity & security', items: ([
    { id: 'identity', kind: 'provider-setting', eyebrow: 'Identity', title: 'Email & identity', summary: 'Managed by Clerk', value: 'cameron@example.com', status: 'Verified', tone: 'success', icon: UserCircle2, meta: [['Provider', 'Clerk'], ['Primary email', 'cameron@example.com'], ['Status', 'Verified'], ['Management', 'Open native identity controls']] },
    { id: 'security', kind: 'provider-setting', eyebrow: 'Security', title: 'Password & authentication', summary: 'Sessions and sign-in methods', value: 'Password, 2FA on', status: 'Protected', tone: 'success', icon: LockKeyhole, meta: [['Two-factor authentication', 'Enabled'], ['Active sessions', '2'], ['Last verified', 'Today'], ['Management', 'Open native security controls']] },
  ] as const satisfies ReadonlyArray<Omit<SettingItem, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('provider-native', 'Clerk'))) },
  { title: 'Studio defaults', items: ([
    { id: 'specialty', kind: 'preference', eyebrow: 'Preference', title: 'Default specialty', summary: 'Guidance when starting a Set', value: 'Games', status: 'Personal default', tone: 'neutral', icon: Sparkles, meta: [['Default', 'Games'], ['Scope', 'Personal preference'], ['Project overrides', 'Allowed'], ['Effect', 'Vocabulary, Kits, and suggestions']] },
    { id: 'kit', kind: 'preference', eyebrow: 'Preference', title: 'Default Kit', summary: 'Suggested coordinated starting point', value: 'Playing Card Deck', status: 'Personal default', tone: 'neutral', icon: Package, meta: [['Default', 'Playing Card Deck'], ['Specialty', 'Games'], ['Starter contents', 'Front master, shared back, records'], ['Project overrides', 'Allowed']] },
    { id: 'presentation', kind: 'preference', eyebrow: 'Accessibility', title: 'Presentation', summary: 'Motion and workspace density', value: 'Compact · Reduced motion', status: 'Follows system', tone: 'neutral', icon: Settings2, meta: [['Color profile', 'Forge'], ['Density', 'Compact'], ['Motion', 'Follow system'], ['Scope', 'Personal preference']] },
  ] as const satisfies ReadonlyArray<Omit<SettingItem, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
];

export const queueItems: readonly QueueItem[] = ([
  { id: 'review-compass', kind: 'forge-review', permission: 'owner', eyebrow: 'Forge Review', title: 'Arcane Compass Back', summary: 'Contribution #CF-DEV-2417', owner: 'Morgan', updated: '2h ago', nextAction: 'Approve or request changes', status: 'In review', tone: 'warning', meta: [['Contributor', 'Morgan Hale'], ['License', 'CardForge Standard License'], ['Destination', 'Arcane Playing Deck'], ['Revision', 'v1.3']] },
  { id: 'drive-attention', kind: 'provider-attention', permission: 'developer', eyebrow: 'Provider attention', title: 'Google Drive connection', summary: 'Creator work is unchanged', owner: 'Riley', updated: '1d ago', nextAction: 'Review configuration', status: 'Attention', tone: 'warning', meta: [['Owner', 'Google Drive'], ['Failure kind', 'Authentication required'], ['Creator impact', 'Drive actions unavailable'], ['Local work', 'Available']] },
  { id: 'webhook-monitor', kind: 'operations-monitor', permission: 'developer', eyebrow: 'Operations', title: 'Creator Pass webhook reconciliation', summary: 'Checked against the Stripe ledger', owner: 'Riley', updated: '3h ago', nextAction: 'Monitor', status: 'Operational', tone: 'success', meta: [['Provider', 'Stripe'], ['Last reconciliation', '3 hours ago'], ['Mismatch count', '0'], ['Next check', 'Scheduled']] },
  { id: 'terms-review', kind: 'legal-publication', permission: 'owner', eyebrow: 'Governance', title: 'Terms of Service update', summary: 'Publication requires owner approval', owner: 'Morgan', updated: '2d ago', nextAction: 'Review and approve', status: 'Blocked', tone: 'danger', meta: [['Publication', 'Terms of Service'], ['State', 'Needs approval'], ['Commitment', 'Binding publication'], ['History', 'Immutable after publish']] },
] as const satisfies ReadonlyArray<Omit<QueueItem, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('provider-native', 'CardForge operations')));

export const studioGroups: ReadonlyArray<{ area: string; title: string; items: readonly StudioArtifact[] }> = [
  { area: 'masters', title: 'Front Masters', items: ([
    { id: 'master-classic', kind: 'template-master', eyebrow: 'Template master', title: 'Classic Front', summary: 'Shared card face system', status: 'Valid', tone: 'success', icon: ImageIcon, meta: [['Referenced by', '11 cards'], ['Revision', 'v0.3'], ['Validation', 'Ready']] },
    { id: 'master-minimal', kind: 'template-master', eyebrow: 'Template master', title: 'Minimal Front', summary: 'Alternate information layout', status: 'Valid', tone: 'success', icon: ImageIcon, meta: [['Referenced by', '4 cards'], ['Revision', 'v0.2'], ['Validation', 'Ready']] },
  ] as const satisfies ReadonlyArray<Omit<StudioArtifact, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
  { area: 'variants', title: 'Card Variants', items: ([
    { id: 'queen-hearts', kind: 'card', eyebrow: 'Card artifact', title: 'Queen of Diamonds', summary: 'Classic Front · Record QD-01', status: 'Selected', tone: 'warning', icon: FileCheck2, imageSrc: '/site-fallbacks/showcase/playing-cards/queen-of-diamonds.webp', meta: [['Template', 'Classic Front'], ['Record', 'QD-01'], ['Group', 'Court cards'], ['Validation', 'Ready for output']] },
    { id: 'king-spades', kind: 'card', eyebrow: 'Card artifact', title: 'King of Hearts', summary: 'Classic Front · Record KH-01', status: 'Valid', tone: 'success', icon: FileCheck2, imageSrc: '/site-fallbacks/showcase/playing-cards/king-of-hearts.webp', meta: [['Template', 'Classic Front'], ['Record', 'KH-01'], ['Group', 'Court cards'], ['Validation', 'Ready']] },
    { id: 'ace-spades', kind: 'card', eyebrow: 'Card artifact', title: 'Ace of Spades', summary: 'Classic Front · Record AS-01', status: 'Valid', tone: 'success', icon: FileCheck2, imageSrc: '/site-fallbacks/showcase/playing-cards/ace-of-spades.webp', meta: [['Template', 'Classic Front'], ['Record', 'AS-01'], ['Group', 'Aces'], ['Validation', 'Ready']] },
  ] as const satisfies ReadonlyArray<Omit<StudioArtifact, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
  { area: 'back', title: 'Shared Back', items: ([
    { id: 'compass-back', kind: 'shared-back', eyebrow: 'Shared back', title: 'Arcane Compass', summary: 'Referenced by 15 cards', status: 'Valid', tone: 'success', icon: Archive, meta: [['Referenced by', '15 cards'], ['Revision', 'v1.3'], ['Validation', 'Print safe']] },
  ] as const satisfies ReadonlyArray<Omit<StudioArtifact, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
  { area: 'rules', title: 'Rules', items: ([
    { id: 'rules-booklet', kind: 'rules', eyebrow: 'Rules artifact', title: 'Rules Booklet', summary: '3-page fixed layout', status: 'Draft', tone: 'neutral', icon: FileText, meta: [['Pages', '3'], ['Revision', 'v0.2'], ['Validation', 'Draft']] },
  ] as const satisfies ReadonlyArray<Omit<StudioArtifact, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
  { area: 'package', title: 'Tuck Box', items: ([
    { id: 'tuck-box', kind: 'package', eyebrow: 'Packaging artifact', title: 'Arcane Tuck Box', summary: 'Poker deck profile', status: 'Preflight ready', tone: 'success', icon: Box, meta: [['Profile', 'Poker deck'], ['Revision', 'v0.1'], ['Preflight', 'Ready']] },
  ] as const satisfies ReadonlyArray<Omit<StudioArtifact, 'actionSources'>>).map((record) => withActionContext(record, sourceContext('browser-local', 'This device'))) },
];

export const detailRecords: readonly DetailRecord[] = [
  homeCurrentWork, ...homeSnapshotItems, ...collectionItems, ...profileGroups.flatMap((group) => group.items),
  ...queueItems, ...studioGroups.flatMap((group) => group.items),
];

export const partialBoundary: EnvironmentBoundaryState = {
  kind: 'partial',
  message: 'One source needs attention. Available work remains visible.',
  failures: [{ kind: 'unavailable', code: 'LIBRARY_SOURCE_UNAVAILABLE', message: 'Google Drive is temporarily unavailable. Device, local-folder, and temporary work remain visible.', retryable: true, nextAction: 'Retry Google Drive', correlationId: 'lab-partial-01' }],
};

const available = { kind: 'available' } as const;
const human = (owner: 'cardforge' | 'provider' = 'cardforge') => ({ kind: 'human-only', owner } as const);

type LabActionInput = Omit<ActionDescriptor, 'supportedSources' | 'revisionPolicy'> & {
  supportedSources?: readonly ActionSource[];
  revisionPolicy?: ActionRevisionPolicy;
};

const action = (value: LabActionInput): ActionDescriptor => ({
  supportedSources: ['provider-native'],
  revisionPolicy: 'none',
  ...value,
});

export const getActionsForRecord = (recipe: RecipeId, record: DetailRecord | null, activeZone: ZoneId): readonly ActionDescriptor[] => {
  if (recipe === 'home') {
    if (!record || record.kind === 'set') return [action({ id: 'home.resume-set', label: 'Resume in Studio', ownerFeature: 'card-generator', supportedObjectKinds: ['set'], supportedSources: ['browser-local', 'google-drive', 'local-folder'], requiredPermission: 'member', scope: record ? 'object' : 'zone', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'navigation' })];
    if (record.kind === 'account-plan') return [action({ id: 'account.compare-plans', label: 'Compare plans', ownerFeature: 'billing', supportedObjectKinds: ['account-plan'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'financial', automation: human('provider'), result: 'provider-handoff' })];
    if (record.kind === 'storage-summary') return [action({ id: 'home.open-library', label: 'Open Library', ownerFeature: 'storage-management', supportedObjectKinds: ['storage-summary'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'navigation' })];
    if (record.kind === 'connection-summary') return [action({ id: 'account.manage-connections', label: 'Manage connections', ownerFeature: 'storage-management', supportedObjectKinds: ['connection-summary'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human('provider'), result: 'provider-handoff' })];
    return [action({ id: 'account.open-security', label: 'Open security controls', ownerFeature: 'account', supportedObjectKinds: ['security-summary'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human('provider'), result: 'provider-handoff' })];
  }

  if (recipe === 'collection') {
    if (!record) return [action({ id: 'library.add-source', label: 'Add to Library', ownerFeature: 'storage-management', supportedObjectKinds: [], requiredPermission: 'member', scope: 'zone', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human('provider'), result: 'provider-handoff' })];
    if (record.kind === 'set') return [
      action({ id: 'library.open-set', label: 'Open in Studio', ownerFeature: 'card-generator', supportedObjectKinds: ['set'], supportedSources: ['browser-local', 'google-drive', 'local-folder'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'navigation' }),
      action({ id: 'library.export-set', label: 'Export package', ownerFeature: 'card-generator', supportedObjectKinds: ['set'], supportedSources: ['browser-local', 'google-drive', 'local-folder'], requiredPermission: 'member', scope: 'object', hierarchy: 'supporting', availability: available, commitment: 'none', automation: human(), result: 'download' }),
    ];
    if (record.kind === 'project') return [action({ id: 'library.open-project', label: 'Open project', ownerFeature: 'project', supportedObjectKinds: ['project'], supportedSources: ['google-drive'], revisionPolicy: 'current-required', requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] }, result: 'navigation' })];
    if (record.kind === 'temporary-draft') return [action({ id: 'library.save-draft', label: 'Make durable', ownerFeature: 'storage-management', supportedObjectKinds: ['temporary-draft'], supportedSources: ['temporary'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human(), result: 'mutation' })];
    return [action({ id: 'library.inspect-template', label: 'Inspect template', ownerFeature: 'template-editor', supportedObjectKinds: ['template'], supportedSources: ['browser-local'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'preview' })];
  }

  if (recipe === 'profile') return record?.kind === 'preference' ? [
    action({ id: 'profile.save-preference', label: 'Save preference', ownerFeature: 'account', supportedObjectKinds: ['preference'], supportedSources: ['browser-local'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'mutation' }),
  ] : [action({ id: 'profile.open-provider', label: 'Open provider controls', ownerFeature: 'account', supportedObjectKinds: ['provider-setting'], requiredPermission: 'member', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human('provider'), result: 'provider-handoff' })];

  if (recipe === 'queue') {
    if (!record) return [];
    if (activeZone === 'developer' && 'permission' in record && record.permission === 'owner') return [];
    if (record.kind === 'forge-review') return [
      action({ id: 'owner.publish-contribution', label: 'Approve & publish', ownerFeature: 'developer-assets', supportedObjectKinds: ['forge-review'], requiredPermission: 'owner', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'publication', automation: { kind: 'planned-mcp', capability: 'publish a reviewed contribution' }, result: 'mutation' }),
      action({ id: 'owner.request-changes', label: 'Request changes', ownerFeature: 'developer-assets', supportedObjectKinds: ['forge-review'], requiredPermission: 'owner', scope: 'object', hierarchy: 'supporting', availability: available, commitment: 'none', automation: { kind: 'planned-mcp', capability: 'request contribution changes' }, result: 'mutation' }),
    ];
    if (record.kind === 'provider-attention') return [action({ id: 'developer.review-provider', label: 'Review configuration', ownerFeature: 'developer-cockpit', supportedObjectKinds: ['provider-attention'], requiredPermission: 'contributor', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'permission', automation: human('provider'), result: 'provider-handoff' })];
    if (record.kind === 'operations-monitor') return [action({ id: 'developer.inspect-monitor', label: 'Inspect monitor', ownerFeature: 'billing', supportedObjectKinds: ['operations-monitor'], requiredPermission: 'contributor', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: 'preview' })];
    return [action({ id: 'owner.publish-legal', label: 'Review publication', ownerFeature: 'legal', supportedObjectKinds: ['legal-publication'], requiredPermission: 'owner', scope: 'object', hierarchy: 'primary', availability: available, commitment: 'publication', automation: human(), result: 'mutation' })];
  }

  if (!record) return [];
  return [
    action({ id: 'studio.edit-selection', label: record.kind === 'card' ? 'Edit card' : 'Inspect object', ownerFeature: record.kind === 'template-master' ? 'template-editor' : 'card-generator', supportedObjectKinds: [record.kind], supportedSources: ['browser-local'], requiredPermission: 'guest', scope: 'selection', hierarchy: 'primary', availability: available, commitment: 'none', automation: human(), result: record.kind === 'card' ? 'mutation' : 'preview' }),
    action({ id: 'studio.validate-selection', label: 'Validate selection', ownerFeature: record.kind === 'template-master' ? 'template-editor' : 'card-generator', supportedObjectKinds: [record.kind], supportedSources: ['browser-local'], requiredPermission: 'guest', scope: 'selection', hierarchy: 'supporting', availability: available, commitment: 'none', automation: human(), result: 'preview' }),
  ];
};
